#!/usr/bin/env node
/* CI orchestration for the content plane (.github/workflows/publish.yml).
   Runs the real CLI library — the same code `npm run storyframe` runs — so
   CI never has a private path. Inputs arrive as env vars:

     SF_ACTION     publish | promote | rollback | disable | enable | redeploy
     SF_SLUG       story slug (publish: empty ⇒ stories changed in this push)
     SF_RELEASE    release id for promote (default: whatever beta points at)
     SF_CHANNEL    channel (publish default: beta; others: production)
     SF_BEFORE     previous commit on push events (all-zero ⇒ first push)

   Writes a Markdown summary to $GITHUB_STEP_SUMMARY and `changed=true|false`
   to $GITHUB_OUTPUT. Never executes anything from a story folder. */
import { spawnSync } from 'node:child_process'
import { appendFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  REPO, buildStory, validateStory, publishStory, promote, rollback, setDisabled, listStories, loadRegistry,
} from '../../packages/story-cli/src/lib.mjs'

const env = (k, d = '') => (process.env[k] ?? d).trim()
const action = env('SF_ACTION', 'publish')
const slugInput = env('SF_SLUG')
const results = []
let failed = false
const record = (slug, step, ok, detail = '') => { results.push({ slug, step, ok, detail }); if (!ok) failed = true }

function changedSlugs() {
  const before = env('SF_BEFORE')
  if (!before || /^0+$/.test(before)) return listStories()           // first push: everything
  const r = spawnSync('git', ['diff', '--name-only', before, 'HEAD', '--', 'stories/'], { cwd: REPO, encoding: 'utf8' })
  if (r.status !== 0) { console.warn('git diff failed — publishing every story'); return listStories() }
  const slugs = new Set(r.stdout.split('\n').map((p) => p.split('/')[1]).filter(Boolean))
  return [...slugs].filter((s) => existsSync(join(REPO, 'stories', s, 'storyframe.json'))).sort()
}

switch (action) {
  case 'publish': {
    const channel = env('SF_CHANNEL', 'beta') || 'beta'
    const slugs = slugInput ? [slugInput] : changedSlugs()
    if (!slugs.length) console.log('no story folders changed — nothing to publish')
    for (const slug of slugs) {
      const dir = join(REPO, 'stories', slug)
      const b = buildStory(dir)
      record(slug, 'build', b.ok, [...b.errors, ...b.warnings].join('; '))
      if (!b.ok) continue
      const v = validateStory(dir)
      record(slug, 'validate', v.ok, [...v.errors, ...v.warnings].join('; '))
      if (!v.ok) continue
      const p = publishStory(dir, { channel })
      record(slug, `publish → ${channel}`, p.ok, p.ok ? `${p.releaseId}${p.created ? '' : ' (existing release)'}` : (p.errors ?? []).join('; '))
    }
    break
  }
  case 'promote': {
    const channel = env('SF_CHANNEL', 'production') || 'production'
    const release = env('SF_RELEASE') || loadRegistry().stories.find((s) => s.slug === slugInput)?.channels?.beta?.releaseId
    const r = release ? promote(slugInput, release, channel) : { ok: false, errors: ['no release given and no beta release to promote'] }
    record(slugInput, `promote → ${channel}`, r.ok, r.ok ? r.releaseId : r.errors.join('; '))
    break
  }
  case 'rollback': {
    const r = rollback(slugInput, env('SF_CHANNEL', 'production') || 'production')
    record(slugInput, 'rollback', r.ok, r.ok ? `${r.from} → ${r.to}${r.warnings?.length ? ' — ' + r.warnings.join('; ') : ''}` : r.errors.join('; '))
    break
  }
  case 'disable': case 'enable': {
    const r = setDisabled(slugInput, action === 'disable', env('SF_CHANNEL', 'production') || 'production')
    record(slugInput, action, r.ok, r.ok ? '' : r.errors.join('; '))
    break
  }
  case 'redeploy': record('*', 'redeploy', true, 'no content change; deploy only'); break
  default: record('*', action, false, 'unknown action')
}

const table = ['| story | step | result | detail |', '|---|---|---|---|',
  ...results.map((r) => `| ${r.slug} | ${r.step} | ${r.ok ? '✅' : '❌'} | ${r.detail.replace(/\|/g, '\\|').slice(0, 300)} |`)]
const summary = `### Storyframe content: ${action}${slugInput ? ' ' + slugInput : ''}\n\n${results.length ? table.join('\n') : '_nothing to do_'}\n`
console.log(summary)
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary)
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${results.some((r) => r.ok && r.step !== 'build' && r.step !== 'validate')}\n`)
process.exit(failed ? 1 : 0)

#!/usr/bin/env node
/* storyframe — new · build · validate · pack · publish · compat · promote ·
   rollback · disable · enable · list · doctor */
import { existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import {
  buildStory, validateStory, packStory, publishStory, promote, rollback, setDisabled,
  checkStoryCompat, newStory, listStories, hostDir, SDK_PATH, REPO, loadRegistry,
} from './lib.mjs'

/* ── args: positionals, --flag value, --flag=value, boolean --flags ─── */
const BOOLEAN = new Set(['yes', 'json', 'all', 'strict'])
function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) { out._.push(a); continue }
    const [key, inline] = a.slice(2).split(/=(.*)/s)
    if (inline !== undefined) out[key] = inline
    else if (BOOLEAN.has(key) || argv[i + 1] === undefined || argv[i + 1].startsWith('--')) out[key] = true
    else out[key] = argv[++i]
  }
  return out
}
const [cmd, ...rest] = process.argv.slice(2)
const args = parseArgs(rest)
const storyDirArg = (i = 0) => {
  const a = args._[i] ?? '.'
  // accept a bare slug as shorthand for stories/<slug>
  return existsSync(resolve(a)) ? resolve(a) : resolve(REPO, 'stories', a)
}

const print = (r) => {
  for (const n of r.notes ?? []) console.log('  · ' + n)
  for (const w of r.warnings ?? []) console.warn('  ⚠ ' + w)
  for (const e of r.errors ?? []) console.error('  ✗ ' + e)
}
const exit = (ok) => process.exit(ok ? 0 : 1)
const targets = () => (args.all ? listStories().map((s) => resolve(REPO, 'stories', s)) : [storyDirArg()])

switch (cmd) {
  case 'new': {
    const slug = args._[0]
    if (!slug) { console.error('usage: storyframe new <slug> --template quick|native|wrap [--title "…"]'); exit(false) }
    const r = newStory(slug, { template: String(args.template ?? 'quick'), title: typeof args.title === 'string' ? args.title : undefined })
    print(r)
    if (r.ok) console.log(`  ✓ created stories/${slug}/ (${r.files.join(', ')})\n    next: npm run storyframe -- build ${slug}`)
    exit(r.ok)
  }
  case 'build': {
    let ok = true
    for (const dir of targets()) {
      const r = buildStory(dir)
      print(r)
      console.log(r.ok ? `  ✓ built ${r.manifest.slug} (${r.lane}) — ${(r.bytes / 1024).toFixed(0)} KB → package/` : `  ✗ build failed: ${dir}`)
      ok &&= r.ok
    }
    exit(ok)
  }
  case 'validate': {
    let ok = true
    for (const dir of targets()) {
      const r = validateStory(dir)
      if (args.json) console.log(JSON.stringify({ ok: r.ok, issues: r.issues, totalBytes: r.totalBytes }, null, 2))
      else {
        for (const i of r.issues ?? []) console[i.severity === 'error' ? 'error' : 'warn'](`  ${i.severity === 'error' ? '✗' : '⚠'} ${i.message}\n      fix: ${i.fix}`)
        if (!r.issues) print(r)
        console.log(r.ok ? `  ✓ valid — ${r.manifest.slug}@${r.manifest.version}` : '  validation failed')
      }
      ok &&= r.ok
    }
    exit(ok)
  }
  case 'pack': {
    const r = packStory(storyDirArg())
    print(r)
    if (r.ok) console.log(`  ✓ packed — ${r.releaseId} (${r.entries.length} files, hash ${r.packageHash.slice(0, 12)})`)
    exit(r.ok)
  }
  case 'publish': {
    const channel = String(args.channel ?? 'beta')
    let ok = true
    for (const dir of targets()) {
      const r = publishStory(dir, { channel })
      print(r)
      if (r.ok) console.log(`  ✓ published ${r.slug} → ${channel} as ${r.releaseId}${r.created ? '' : ' (release already existed — pointer only)'}`)
      ok &&= r.ok
    }
    exit(ok)
  }
  case 'compat': {
    const r = checkStoryCompat(storyDirArg(), String(args.channel ?? 'production'))
    for (const b of r.blocking ?? []) console.error(`  ✗ ${b.message}\n      fix: ${b.fix}`)
    print({ warnings: r.warnings, errors: r.errors })
    console.log(r.ok ? `  ✓ compatible${r.against ? ' with ' + r.against : ''}` : '  ✗ not compatible — promotion would be blocked')
    exit(r.ok)
  }
  case 'promote': {
    const [slug, releaseId] = args._
    let rel = releaseId
    if (!rel) {
      // default: promote whatever beta points at
      rel = loadRegistry().stories.find((s) => s.slug === slug)?.channels?.beta?.releaseId
      if (!rel) { console.error('usage: storyframe promote <slug> [releaseId] [--channel production]'); exit(false) }
    }
    const r = promote(slug, rel, String(args.channel ?? 'production'))
    print(r)
    if (r.ok) console.log(`  ✓ promoted ${slug} → ${r.releaseId}`)
    exit(r.ok)
  }
  case 'rollback': {
    const r = rollback(args._[0], String(args.channel ?? 'production'))
    print(r)
    if (r.ok) console.log(`  ✓ rolled back ${args._[0]}: ${r.from} → ${r.to}`)
    exit(r.ok)
  }
  case 'disable': case 'enable': {
    const r = setDisabled(args._[0], cmd === 'disable', String(args.channel ?? 'production'))
    print(r)
    if (r.ok) console.log(`  ✓ ${cmd}d ${args._[0]}`)
    exit(r.ok)
  }
  case 'list': {
    const reg = loadRegistry()
    for (const s of reg.stories) {
      const ch = Object.entries(s.channels).map(([c, v]) => `${c}=${v.releaseId}${v.disabled ? ' (disabled)' : ''}`).join('  ')
      console.log(`  ${s.slug.padEnd(28)} ${ch}  [${s.releases.length} releases]`)
    }
    if (!reg.stories.length) console.log('  (no published stories in ' + hostDir() + ')')
    exit(true)
  }
  case 'doctor': {
    const major = Number(process.versions.node.split('.')[0])
    const git = spawnSync('git', ['--version'], { encoding: 'utf8', shell: process.platform === 'win32' })
    let playwright = { ok: false, detail: 'not installed — npm install, then npx playwright install chromium' }
    try {
      const pw = await import('playwright')
      const exe = pw.chromium.executablePath()
      playwright = existsSync(exe)
        ? { ok: true, detail: 'chromium ready' }
        : { ok: false, detail: 'package present, browser missing — run: npx playwright install chromium' }
    } catch { /* stays not installed */ }
    const env = (k) => !!process.env[k]
    const checks = [
      ['Node ≥ 20', major >= 20, `found ${process.versions.node}`, true],
      ['SDK built', existsSync(SDK_PATH), existsSync(SDK_PATH) ? 'packages/story-sdk/dist' : 'run: npm run sdk:build', true],
      ['git available', git.status === 0, git.status === 0 ? git.stdout.trim() : 'install Git for Windows / apt install git', true],
      ['Playwright + Chromium (npm run verify)', playwright.ok, playwright.detail, false],
      ['content plane directory', existsSync(hostDir()), existsSync(hostDir()) ? hostDir() : 'created on first publish', false],
      ['CLOUDFLARE_API_TOKEN (deploy only)', env('CLOUDFLARE_API_TOKEN'), 'needed only to deploy from this machine; CI reads it from GitHub secrets', false],
      ['CLOUDFLARE_ACCOUNT_ID (deploy only)', env('CLOUDFLARE_ACCOUNT_ID'), 'needed only to deploy from this machine', false],
    ]
    for (const [name, ok, detail, required] of checks)
      console.log(`  ${ok ? '✓' : required ? '✗' : '·'} ${name.padEnd(40)} ${detail}`)
    exit(checks.every(([, ok, , required]) => ok || !required))
  }
  default:
    console.log(`storyframe <command>

  new      <slug> --template quick|native|wrap   scaffold stories/<slug>/ with a fresh storyId
  build    <story|slug> [--all]                  declarative build → package/ (never runs story code)
  validate <story|slug> [--all] [--json]         the release gate (same code as the Admin Studio)
  pack     <story|slug>                          validate + deterministic content hash / release id
  publish  <story|slug> [--all] --channel <c>    immutable release + channel pointer (default: beta)
  compat   <story|slug> [--channel production]   can current readers resume on this build?
  promote  <slug> [releaseId]                    move production to a release (default: beta's) — compat-gated
  rollback <slug>                                production back to the previous release
  disable | enable <slug>                        kill switch for new launches
  list                                           channels and releases in the content plane
  doctor                                         environment check (Node, SDK, git, Playwright, deploy env)

  content plane: ${hostDir()}  (override with STORYFRAME_HOST_DIR)`)
}

#!/usr/bin/env node
/* storyframe — validate · pack · publish · promote · rollback · disable · doctor */
import { validateStory, packStory, publishStory, promote, rollback, setDisabled, HOST_DIR } from './lib.mjs'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const [cmd, ...rest] = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = rest.indexOf('--' + name)
  return i >= 0 ? (rest[i + 1]?.startsWith('--') || rest[i + 1] === undefined ? true : rest[i + 1]) : fallback
}
const args = rest.filter((a) => !a.startsWith('--') && rest[rest.indexOf(a) - 1] !== '--channel')

const print = (r) => {
  for (const w of r.warnings ?? []) console.warn('  ⚠ ' + w)
  for (const e of r.errors ?? []) console.error('  ✗ ' + e)
}

switch (cmd) {
  case 'validate': {
    const r = validateStory(resolve(args[0] ?? '.'))
    print(r)
    console.log(r.ok ? `  ✓ valid — ${r.manifest.slug}@${r.manifest.version}` : '  validation failed')
    process.exit(r.ok ? 0 : 1)
  }
  case 'pack': {
    const r = packStory(resolve(args[0] ?? '.'))
    print(r)
    if (r.ok) console.log(`  ✓ packed — hash ${r.packageHash.slice(0, 12)} (${r.entries.length} files)`)
    process.exit(r.ok ? 0 : 1)
  }
  case 'publish': {
    const channel = String(flag('channel', 'beta'))
    const r = publishStory(resolve(args[0] ?? '.'), { channel })
    print(r)
    if (r.ok) console.log(`  ✓ published ${r.slug} → ${channel} as ${r.releaseId}`)
    process.exit(r.ok ? 0 : 1)
  }
  case 'promote': {
    const r = promote(args[0], args[1], String(flag('channel', 'production')))
    print(r); if (r.ok) console.log(`  ✓ promoted ${args[0]} → ${r.releaseId}`)
    process.exit(r.ok ? 0 : 1)
  }
  case 'rollback': {
    const r = rollback(args[0], String(flag('channel', 'production')))
    print(r); if (r.ok) console.log(`  ✓ rolled back ${args[0]}: ${r.from} → ${r.to}`)
    process.exit(r.ok ? 0 : 1)
  }
  case 'disable': case 'enable': {
    const r = setDisabled(args[0], cmd === 'disable')
    print(r); if (r.ok) console.log(`  ✓ ${cmd}d ${args[0]}`)
    process.exit(r.ok ? 0 : 1)
  }
  case 'doctor': {
    const checks = [
      ['node ≥ 20', Number(process.versions.node.split('.')[0]) >= 20],
      ['sdk built', existsSync(resolve(HOST_DIR, '../../..', 'packages/story-sdk/dist/storyframe-sdk.iife.js'))],
      ['host dir', true],
    ]
    checks.forEach(([n, ok]) => console.log(`  ${ok ? '✓' : '✗'} ${n}`))
    process.exit(checks.every(([, ok]) => ok) ? 0 : 1)
  }
  default:
    console.log(`storyframe <command>

  validate <storyDir>                 check manifest, budgets, self-containment
  pack     <storyDir>                 validate + deterministic content hash
  publish  <storyDir> --channel <c>   immutable release + channel pointer
  promote  <slug> <releaseId>         move a channel pointer to a release
  rollback <slug>                     restore the previous production release
  disable | enable <slug>             kill switch for new launches
  doctor                              environment sanity check`)
}

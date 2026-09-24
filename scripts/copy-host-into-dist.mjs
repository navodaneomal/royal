#!/usr/bin/env node
/* Single-origin build: bundle the published releases into the app's dist
   under /stories-host. The player detects same-origin and uses opaque
   sandboxes, so stories still never touch application storage. */
import { cpSync, existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { hostDir } from '../packages/story-cli/src/lib.mjs'

const from = hostDir()
const to = resolve('apps/web/dist/stories-host')
if (!existsSync(from)) { console.error('no published stories — run npm run stories:publish'); process.exit(1) }
cpSync(from, to, { recursive: true, filter: (src) => !/[\\/]\.git([\\/]|$)/.test(src) })
// runtime config for the single-origin preview (ADR-0008) unless one exists
const config = resolve('apps/web/dist/config.json')
if (!existsSync(config)) writeFileSync(config, JSON.stringify({ storyOrigin: '/stories-host' }, null, 2) + '\n')
console.log('stories-host copied into apps/web/dist')

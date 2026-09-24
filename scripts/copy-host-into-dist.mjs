#!/usr/bin/env node
/* Single-origin build: bundle the published releases into the app's dist
   under /stories-host. The player detects same-origin and uses opaque
   sandboxes, so stories still never touch application storage. */
import { cpSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
const from = resolve('infra/story-host/stories-host')
const to = resolve('apps/web/dist/stories-host')
if (!existsSync(from)) { console.error('no published stories — run npm run stories:publish'); process.exit(1) }
cpSync(from, to, { recursive: true })
console.log('stories-host copied into apps/web/dist')

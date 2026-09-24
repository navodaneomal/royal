#!/usr/bin/env node
/* Builds the Tulip & Jester story package: concatenates the source parts,
   inlines the Storyframe SDK (no external origins allowed in packages),
   and emits package/index.html + storyframe.json + cover.svg. */
import { readFileSync, writeFileSync, mkdirSync, cpSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../..')
const read = (p) => readFileSync(resolve(here, p), 'utf8')

const sdk = readFileSync(resolve(repo, 'packages/story-sdk/dist/storyframe-sdk.iife.js'), 'utf8')

const parts = [
  read('src/00-head.html'),
  read('src/10-body.html'),
  `<script>\n${sdk}\nwindow.Storyframe = StoryframeSDK.Storyframe;\n</script>`,
  read('src/45-storyframe-glue.js'),
  read('src/20-story-a.js'),
  read('src/21-story-b.js'),
  read('src/22-story-c.js'),
  read('src/23-story-d.js'),
  read('src/30-world.js'),
  read('src/40-art.js'),
  read('src/50-app.js'),
]
let html = parts.map((s) => s.replace(/\s+$/, '')).join('\n')
// Packages must be self-contained (§13.4): no remote fonts. The story's
// fallback stack (Iowan Old Style → Palatino → Georgia) was chosen for this.
html = html.replace(/<link rel="preconnect"[^>]*>\s*/g, '')
html = html.replace(/<link rel="stylesheet" href="https:\/\/fonts[^>]*>\s*/g, '')
// release id is stamped at publish time; a data attribute carries it
html = html.replace('<html lang="en"', '<html lang="en" data-sf-release="__SF_RELEASE_ID__"')

mkdirSync(resolve(here, 'package'), { recursive: true })
writeFileSync(resolve(here, 'package/index.html'), html)
cpSync(resolve(here, 'storyframe.json'), resolve(here, 'package/storyframe.json'))
cpSync(resolve(here, 'cover.svg'), resolve(here, 'package/cover.svg'))
console.log(`tulip package built — ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`)

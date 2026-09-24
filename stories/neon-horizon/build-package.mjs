#!/usr/bin/env node
/* Neon Horizon package build: inlines styles/script/SDK into one file so the
   package is offline-eligible under the single-file rule (see ADR-0003). */
import { readFileSync, writeFileSync, mkdirSync, cpSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../..')
let html = readFileSync(resolve(here, 'src/index.html'), 'utf8')
const story = readFileSync(resolve(here, 'src/story.js'), 'utf8')
const sdk = readFileSync(resolve(repo, 'packages/story-sdk/dist/storyframe-sdk.iife.js'), 'utf8')

html = html.replace('<script src="./storyframe-sdk.js"></script>',
  `<script>\n${sdk}\nwindow.Storyframe = StoryframeSDK.Storyframe;\n</script>`)
html = html.replace('<script src="./story.js"></script>', `<script>\n${story}\n</script>`)

mkdirSync(resolve(here, 'package'), { recursive: true })
writeFileSync(resolve(here, 'package/index.html'), html)
cpSync(resolve(here, 'storyframe.json'), resolve(here, 'package/storyframe.json'))
cpSync(resolve(here, 'cover.svg'), resolve(here, 'package/cover.svg'))
console.log(`neon-horizon package built — ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`)

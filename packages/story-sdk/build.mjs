#!/usr/bin/env node
/* Builds the SDK as a single IIFE file that `storyframe pack` inlines into
   every story package — no third-party origins, per budget rules (§13.4). */
import { build } from 'esbuild'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
mkdirSync(resolve(here, 'dist'), { recursive: true })
await build({
  entryPoints: [resolve(here, 'src/index.js')],
  bundle: true,
  format: 'iife',
  globalName: 'StoryframeSDK',
  outfile: resolve(here, 'dist/storyframe-sdk.iife.js'),
  target: 'es2020',
  minify: false,
  banner: { js: '/* @storyframe/sdk 1.0.0 — protocol 1.0 */' },
})
console.log('sdk built → packages/story-sdk/dist/storyframe-sdk.iife.js')

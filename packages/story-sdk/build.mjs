#!/usr/bin/env node
/* Builds the SDK as a single IIFE file that the declarative builder inlines
   into every story package — no third-party origins, per budget rules (§13.4). */
import { build } from 'esbuild'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { SDK_BUILD_OPTIONS, SDK_OUTFILE } from './build-options.mjs'

mkdirSync(dirname(SDK_OUTFILE), { recursive: true })
await build({ ...SDK_BUILD_OPTIONS, outfile: SDK_OUTFILE })
console.log('sdk built → packages/story-sdk/dist/storyframe-sdk.iife.js')

/* Shared test helpers: an in-memory SDK build and story folders as file maps. */
import { buildSync } from 'esbuild'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SDK_BUILD_OPTIONS } from '../../packages/story-sdk/build-options.mjs'
import { readTree } from '../../packages/story-cli/src/lib.mjs'
import { toBytes } from '@storyframe/publishing'

export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
let sdk = null
export function sdkText() {
  if (!sdk) sdk = buildSync({ ...SDK_BUILD_OPTIONS, write: false }).outputFiles[0].text
  return sdk
}
export const storySource = (slug) => readTree(resolve(REPO, 'stories', slug))
export const fileMap = (obj) => new Map(Object.entries(obj).map(([k, v]) => [k, toBytes(v)]))
export const json = (bytes) => JSON.parse(new TextDecoder().decode(bytes))
export const text = (bytes) => new TextDecoder().decode(bytes)

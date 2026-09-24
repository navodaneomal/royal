/* esbuild options for the SDK IIFE — shared by build.mjs and the tests so
   the tests never depend on a stale dist/ file. */
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
export const SDK_BUILD_OPTIONS = {
  entryPoints: [resolve(here, 'src/index.js')],
  bundle: true,
  format: 'iife',
  globalName: 'StoryframeSDK',
  target: 'es2020',
  minify: false,
  banner: { js: '/* @storyframe/sdk 1.1.0 — protocol 1.1 (speaks 1.0 to 1.0 hosts) */' },
}
export const SDK_OUTFILE = resolve(here, 'dist/storyframe-sdk.iife.js')

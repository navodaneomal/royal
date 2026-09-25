#!/usr/bin/env node
/* Prepare the Android project: copy the built web app into www/, give it a
   runtime config.json, and run `cap sync` (adding the platform on first run).

   Story origin:
     STORIES_ORIGIN=https://… → the APK reads your live library (cross-origin frames)
     unset                    → the published content plane is bundled INTO the
                                APK and every story runs in the opaque sandbox
                                (works with no server at all)

   The app is served from https://localhost inside the WebView, so a remote
   stories origin is always a different origin (the non-opaque online mode). */
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const MOBILE = resolve(here, '..')
const REPO = resolve(MOBILE, '../..')
const DIST = join(REPO, 'apps', 'web', 'dist')
const WWW = join(MOBILE, 'www')
const HOST = process.env.STORYFRAME_HOST_DIR || join(REPO, 'infra', 'story-host', 'stories-host')

if (!existsSync(join(DIST, 'index.html'))) { console.error('apps/web/dist missing — run `npm run build:app` (or `npm run build`) first'); process.exit(1) }
rmSync(WWW, { recursive: true, force: true })
mkdirSync(WWW, { recursive: true })
cpSync(DIST, WWW, { recursive: true, filter: (src) => !src.startsWith(join(DIST, 'stories-host')) })

let config = null
if (process.env.STORIES_ORIGIN) config = { storyOrigin: process.env.STORIES_ORIGIN.replace(/\/$/, '') }
if (config && /^https?:\/\//.test(config.storyOrigin ?? '')) {
  console.log(`  story origin: ${config.storyOrigin} (remote, cross-origin frames)`)
} else {
  if (!existsSync(join(HOST, 'registry.json'))) { console.error(`no stories to bundle in ${HOST} — run npm run stories:publish, or set STORIES_ORIGIN`); process.exit(1) }
  cpSync(HOST, join(WWW, 'stories-host'), { recursive: true, filter: (src) => !/[\\/]\.git([\\/]|$)/.test(src) })
  config = { ...(config ?? {}), storyOrigin: '/stories-host' }
  console.log('  story origin: bundled into the APK (/stories-host, opaque sandbox)')
}
writeFileSync(join(WWW, 'config.json'), JSON.stringify(config, null, 2) + '\n')

const win = process.platform === 'win32'
const cap = (...args) => {
  const r = spawnSync(win ? 'npx.cmd' : 'npx', ['--no-install', 'cap', ...args], { cwd: MOBILE, stdio: 'inherit', shell: win })
  if (r.status !== 0) process.exit(r.status ?? 1)
}
if (!existsSync(join(MOBILE, 'android'))) cap('add', 'android')
cap('sync', 'android')
console.log('  ✓ android project synced — build with: cd apps/mobile/android && ./gradlew assembleDebug')

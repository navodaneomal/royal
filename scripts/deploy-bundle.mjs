#!/usr/bin/env node
/* Drag-and-drop deploy bundles for Cloudflare Pages (DEPLOY.md).

   deploy/app/            + app.zip             app shell (two-origin production mode)
   deploy/stories/        + stories.zip         the content plane (+ _headers)
   deploy/single-origin/  + single-origin.zip   starter mode: one project, every story opaque

   Each gets a generated _headers (packages/publishing/src/headers.js) and the
   app bundles a runtime /config.json (ADR-0008) — re-point a bundle by
   editing config.json, not by rebuilding.

   node scripts/deploy-bundle.mjs [--app-origin https://x.pages.dev]
       [--stories-origin https://y.pages.dev] [--repo owner/name]
       [--supabase-url …] [--supabase-anon-key …] [--only app|stories|single] [--zip]

   Without origins the bundles assume the Cloudflare project names
   "storyframe-app" and "storyframe-stories" and allow any *.pages.dev
   origin in CSP/CORS so they still work if Cloudflare adds a suffix. */
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync, readdirSync, statSync, readFileSync } from 'node:fs'
import { join, resolve, relative, sep } from 'node:path'
import { zipSync } from 'fflate'
import { hostDir, REPO } from '../packages/story-cli/src/lib.mjs'
import { appHeaders, storiesHeaders, singleOriginHeaders } from '../packages/publishing/src/headers.js'
import { writeShareCards } from './share-cards.mjs'

const argv = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`))
  if (i < 0) return fallback
  return argv[i].includes('=') ? argv[i].split(/=(.*)/s)[1] : argv[i + 1]
}
const clean = (o) => (o ? o.replace(/\/+$/, '') : o)
const appOrigin = clean(arg('app-origin', process.env.APP_ORIGIN || ''))
const storiesOrigin = clean(arg('stories-origin', process.env.STORIES_ORIGIN || ''))
const repo = arg('repo', process.env.GITHUB_REPOSITORY || '')
const supabaseUrl = clean(arg('supabase-url', process.env.SUPABASE_URL || ''))
const supabaseAnonKey = arg('supabase-anon-key', process.env.SUPABASE_ANON_KEY || '')
const only = arg('only', '')
const zip = argv.includes('--zip')
const OUT = resolve(REPO, arg('out', 'deploy'))
const DIST = join(REPO, 'apps', 'web', 'dist')
const HOST = hostDir()

const DEFAULT_APP = 'https://storyframe-app.pages.dev'
const DEFAULT_STORIES = 'https://storyframe-stories.pages.dev'
const PAGES_WILDCARD = 'https://*.pages.dev'
// Capacitor's Android WebView serves the app from https://localhost
const CAPACITOR = 'https://localhost'

const noGit = (src) => !/[\\/]\.git([\\/]|$)/.test(src)
function fresh(dir) { rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true }) }
function writeJson(file, value) { writeFileSync(file, JSON.stringify(value, null, 2) + '\n') }
function config(storyOrigin) {
  const c = { storyOrigin }
  if (repo) c.githubRepo = repo
  if (supabaseUrl && supabaseAnonKey) { c.supabaseUrl = supabaseUrl; c.supabaseAnonKey = supabaseAnonKey }
  return c
}

function zipDir(dir, file) {
  const entries = {}
  const walk = (abs) => {
    for (const name of readdirSync(abs).sort()) {
      const p = join(abs, name)
      if (statSync(p).isDirectory()) walk(p)
      else entries[relative(dir, p).split(sep).join('/')] = [new Uint8Array(readFileSync(p)), { mtime: new Date('2026-01-01T00:00:00Z') }]
    }
  }
  walk(dir)
  const bytes = zipSync(entries, { level: 9 })
  writeFileSync(file, bytes)
  return { files: Object.keys(entries).length, bytes: bytes.byteLength }
}

const made = []
if (!existsSync(DIST)) { console.error('apps/web/dist missing — run `npm run build` first'); process.exit(1) }

if (!only || only === 'app') {
  const dir = join(OUT, 'app')
  fresh(dir)
  cpSync(DIST, dir, { recursive: true, filter: (src) => noGit(src) && !src.startsWith(join(DIST, 'stories-host')) })
  writeJson(join(dir, 'config.json'), config(storiesOrigin || DEFAULT_STORIES))
  writeFileSync(join(dir, '_headers'), appHeaders({
    storyOrigins: storiesOrigin ? [storiesOrigin] : [PAGES_WILDCARD],
    connectOrigins: supabaseUrl ? [supabaseUrl] : [],
  }))
  made.push(['app', dir])
}

if (!only || only === 'stories') {
  if (!existsSync(join(HOST, 'registry.json'))) { console.error(`no published stories in ${HOST} — run npm run stories:publish`); process.exit(1) }
  const dir = join(OUT, 'stories')
  fresh(dir)
  cpSync(HOST, dir, { recursive: true, filter: noGit })
  // CORS can name only one origin; --with-android adds the Capacitor WebView
  // origin, which (being a second origin) falls back to "*" for public content
  const apps = appOrigin ? [appOrigin, ...(argv.includes('--with-android') ? [CAPACITOR] : [])] : []
  writeFileSync(join(dir, '_headers'), storiesHeaders({ appOrigins: apps }))
  await writeShareCards(dir, { appUrl: appOrigin || DEFAULT_APP, storiesUrl: storiesOrigin || DEFAULT_STORIES })
  made.push(['stories', dir])
}

if (!only || only === 'single') {
  const dir = join(OUT, 'single-origin')
  fresh(dir)
  cpSync(DIST, dir, { recursive: true, filter: noGit })
  if (!existsSync(join(dir, 'stories-host', 'registry.json'))) cpSync(HOST, join(dir, 'stories-host'), { recursive: true, filter: noGit })
  writeJson(join(dir, 'config.json'), config('/stories-host'))
  writeFileSync(join(dir, '_headers'), singleOriginHeaders({ connectOrigins: supabaseUrl ? [supabaseUrl] : [] }))
  await writeShareCards(join(dir, 'stories-host'), { appUrl: '../../', storiesUrl: appOrigin ? `${appOrigin}/stories-host` : '' })
  made.push(['single-origin', dir])
}

for (const [name, dir] of made) {
  if (zip) {
    const z = zipDir(dir, join(OUT, `${name}.zip`))
    console.log(`  ✓ deploy/${name}.zip — ${z.files} files, ${(z.bytes / 1024).toFixed(0)} KB`)
  } else console.log(`  ✓ deploy/${name}/`)
}
if (!appOrigin || !storiesOrigin) {
  console.log(`\n  note: origins not given — assumed ${DEFAULT_APP} and ${DEFAULT_STORIES};
        CSP/CORS allow any *.pages.dev. Re-run with --app-origin/--stories-origin to lock them down.`)
}

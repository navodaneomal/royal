#!/usr/bin/env node
/* Static preview server for the built app (single origin, SW-friendly).
   PREVIEW_CONFIG='{"storyOrigin":"http://localhost:4174"}' serves a
   different /config.json without touching dist — the runtime-config path
   (ADR-0008) that lets one build point at a separate story origin.

   PREVIEW_DIR=deploy/pages BASE_PATH=/royal/ serves a bundle under a
   sub-path the way GitHub Pages does (missing files are 404s, nothing is
   served outside the sub-path) — the audit runs against it too. */
import { createServer } from 'node:http'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { join, normalize, extname, sep, resolve } from 'node:path'
import { appCsp } from '../packages/publishing/src/headers.js'
import { STORY_CSP } from '../packages/publishing/src/policy.js'

const ROOT = resolve(process.cwd(), process.env.PREVIEW_DIR || join('apps', 'web', 'dist'))
const PORT = Number(process.env.PORT || 4173)
const CONFIG = process.env.PREVIEW_CONFIG ?? null
const BASE_PATH = ('/' + (process.env.BASE_PATH || '/').replace(/^\/+|\/+$/g, '') + '/').replace(/\/+/g, '/')
const PAGES_LIKE = BASE_PATH !== '/'
// Production headers, as Cloudflare `_headers` sends them (headers.js) — so the
// audit runs with the app CSP enforced. A Pages-like bundle carries its CSP as
// <meta> instead and gets no headers, exactly like GitHub Pages.
const storyOrigin = (() => { try { return new URL(JSON.parse(CONFIG ?? '{}').storyOrigin).origin } catch { return null } })()
const APP_CSP = appCsp({ storyOrigins: storyOrigin ? [storyOrigin] : [] })
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.txt': 'text/plain',
}
if (!existsSync(ROOT)) { console.error('no build — run npm run build'); process.exit(1) }

createServer((req, res) => {
  const full = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  if (PAGES_LIKE && full === BASE_PATH.slice(0, -1)) { res.writeHead(301, { location: BASE_PATH }); res.end(); return }
  if (!full.startsWith(BASE_PATH)) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found'); return }
  const pathname = '/' + full.slice(BASE_PATH.length)
  if (CONFIG && pathname === '/config.json') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-cache' })
    res.end(CONFIG)
    return
  }
  const path = normalize(pathname).replace(/^[\\/]+/, '')
  let file = join(ROOT, path)
  if (existsSync(file) && statSync(file).isDirectory() && existsSync(join(file, 'index.html'))) file = join(file, 'index.html')
  if (!(file + sep).startsWith(ROOT + sep) || !existsSync(file) || statSync(file).isDirectory()) {
    if (PAGES_LIKE) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found'); return }
    file = join(ROOT, 'index.html')
  }
  const isStory = path.startsWith('stories-host/packages/')
  const isAppDoc = file === join(ROOT, 'index.html')
  res.writeHead(200, {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    'cache-control': isStory ? 'public, max-age=31536000, immutable' : 'no-cache',
    'x-content-type-options': 'nosniff',
    ...(!PAGES_LIKE && isAppDoc ? { 'content-security-policy': APP_CSP } : {}),
    ...(!PAGES_LIKE && isStory && extname(file) === '.html' ? { 'content-security-policy': `${STORY_CSP}; frame-ancestors 'self'` } : {}),
  })
  res.end(readFileSync(file))
}).listen(PORT, () => console.log(`preview → http://localhost:${PORT}${BASE_PATH}${CONFIG ? '  (config override)' : ''}`))

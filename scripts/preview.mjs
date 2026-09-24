#!/usr/bin/env node
/* Static preview server for the built app (single origin, SW-friendly).
   PREVIEW_CONFIG='{"storyOrigin":"http://localhost:4174"}' serves a
   different /config.json without touching dist — the runtime-config path
   (ADR-0008) that lets one build point at a separate story origin. */
import { createServer } from 'node:http'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { join, normalize, extname, sep } from 'node:path'

const ROOT = join(process.cwd(), 'apps', 'web', 'dist')
const PORT = Number(process.env.PORT || 4173)
const CONFIG = process.env.PREVIEW_CONFIG ?? null
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.txt': 'text/plain',
}
if (!existsSync(ROOT)) { console.error('no build — run npm run build'); process.exit(1) }

createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  if (CONFIG && pathname === '/config.json') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-cache' })
    res.end(CONFIG)
    return
  }
  const path = normalize(pathname).replace(/^[\\/]+/, '')
  let file = join(ROOT, path)
  if (!(file + sep).startsWith(ROOT + sep) || !existsSync(file) || statSync(file).isDirectory()) file = join(ROOT, 'index.html')
  res.writeHead(200, {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    'cache-control': path.startsWith('stories-host/packages/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    'x-content-type-options': 'nosniff',
  })
  res.end(readFileSync(file))
}).listen(PORT, () => console.log(`preview → http://localhost:${PORT}${CONFIG ? '  (config override)' : ''}`))

#!/usr/bin/env node
/* Static preview server for the built app (single origin, SW-friendly). */
import { createServer } from 'node:http'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { join, normalize, extname } from 'node:path'
const ROOT = join(process.cwd(), 'apps/web/dist')
const PORT = Number(process.env.PORT || 4173)
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.png': 'image/png' }
createServer((req, res) => {
  let path = normalize(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '')
  let file = join(ROOT, path)
  if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) file = join(ROOT, 'index.html')
  res.writeHead(200, {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    'cache-control': path.startsWith('stories-host/packages/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    'x-content-type-options': 'nosniff',
  })
  res.end(readFileSync(file))
}).listen(PORT, () => console.log(`preview → http://localhost:${PORT}`))

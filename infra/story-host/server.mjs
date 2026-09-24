#!/usr/bin/env node
/* The content plane, locally: serves immutable story releases with the
   headers the blueprint asks for (§11.2, §19.2), plus a tiny dev-only
   admin API the operator console uses for promote/rollback/kill-switch.
   In production this role is played by Cloudflare Pages or a Worker —
   see infra/story-host/README.md for the adapter notes. */
import { createServer } from 'node:http'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { join, normalize, extname } from 'node:path'
import { HOST_DIR, promote, rollback, setDisabled, loadRegistry } from '../../packages/story-cli/src/lib.mjs'

const PORT = Number(process.env.STORY_HOST_PORT || 4174)
const ADMIN_TOKEN = process.env.STORYFRAME_ADMIN_TOKEN || 'dev-admin'
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.mp3': 'audio/mpeg',
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  res.setHeader('Access-Control-Allow-Origin', '*')            // registry + verified downloads
  res.setHeader('X-Content-Type-Options', 'nosniff')

  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return }

  if (url.pathname.startsWith('/admin/')) {
    if (req.headers['x-admin-token'] !== ADMIN_TOKEN) { res.writeHead(401).end('{"error":"unauthorized"}'); return }
    let body = ''
    for await (const chunk of req) body += chunk
    const data = body ? JSON.parse(body) : {}
    let out
    if (url.pathname === '/admin/promote') out = promote(data.slug, data.releaseId, data.channel ?? 'production')
    else if (url.pathname === '/admin/rollback') out = rollback(data.slug, data.channel ?? 'production')
    else if (url.pathname === '/admin/disable') out = setDisabled(data.slug, true)
    else if (url.pathname === '/admin/enable') out = setDisabled(data.slug, false)
    else out = { ok: false, errors: ['unknown admin action'] }
    res.writeHead(out.ok ? 200 : 400, { 'content-type': 'application/json' })
    res.end(JSON.stringify(out))
    return
  }

  let path = normalize(url.pathname).replace(/^\/+/, '')
  if (path === '' || path === '.') path = 'registry.json'
  const file = join(HOST_DIR, path)
  if (!file.startsWith(HOST_DIR) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404, { 'content-type': 'application/json' }).end('{"error":"not found"}')
    return
  }
  const immutable = path.startsWith('packages/')
  res.writeHead(200, {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-store',
    ...(extname(file) === '.html' ? {
      'content-security-policy':
        "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' 'self'; img-src 'self' data:; media-src 'self' data:; connect-src 'none'; base-uri 'none'; form-action 'none'",
      'referrer-policy': 'no-referrer',
    } : {}),
  })
  res.end(readFileSync(file))
})

server.listen(PORT, () => {
  const reg = loadRegistry()
  console.log(`story host  → http://localhost:${PORT}  (${reg.stories.length} stories, admin token: ${ADMIN_TOKEN === 'dev-admin' ? 'dev-admin (dev only)' : 'set'})`)
})

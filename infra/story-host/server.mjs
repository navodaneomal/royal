#!/usr/bin/env node
/* The content plane, locally: serves immutable story releases with the
   headers the blueprint asks for (§11.2, §19.2), plus a tiny dev-only
   admin API the operator console uses for promote/rollback/kill-switch.
   In production this role is played by Cloudflare Pages — the same CSP
   comes from packages/publishing/src/policy.js via the generated _headers. */
import { createServer } from 'node:http'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { join, normalize, extname, sep } from 'node:path'
import { hostDir, promote, rollback, setDisabled, loadRegistry } from '../../packages/story-cli/src/lib.mjs'
import { STORY_CSP } from '../../packages/publishing/src/policy.js'

const PORT = Number(process.env.STORY_HOST_PORT || 4174)
const ADMIN_TOKEN = process.env.STORYFRAME_ADMIN_TOKEN || 'dev-admin'
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg',
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  res.setHeader('Access-Control-Allow-Origin', '*')            // public, credential-free content
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-admin-token')
  res.setHeader('X-Content-Type-Options', 'nosniff')

  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return }

  if (url.pathname.startsWith('/admin/')) {
    if (req.headers['x-admin-token'] !== ADMIN_TOKEN) { res.writeHead(401).end('{"error":"unauthorized"}'); return }
    let body = ''
    for await (const chunk of req) body += chunk
    let data = {}
    try { data = body ? JSON.parse(body) : {} } catch { res.writeHead(400).end('{"error":"bad json"}'); return }
    let out
    if (url.pathname === '/admin/ping') out = { ok: true, mode: 'dev-admin-api' }
    else if (url.pathname === '/admin/promote') out = promote(data.slug, data.releaseId, data.channel ?? 'production')
    else if (url.pathname === '/admin/rollback') out = rollback(data.slug, data.channel ?? 'production')
    else if (url.pathname === '/admin/disable') out = setDisabled(data.slug, true)
    else if (url.pathname === '/admin/enable') out = setDisabled(data.slug, false)
    else out = { ok: false, errors: ['unknown admin action'] }
    res.writeHead(out.ok ? 200 : 400, { 'content-type': 'application/json' })
    res.end(JSON.stringify(out))
    return
  }

  const root = hostDir()
  let path = normalize(decodeURIComponent(url.pathname)).replace(/^[\\/]+/, '')
  if (path === '' || path === '.') path = 'registry.json'
  const file = join(root, path)
  if (!(file + sep).startsWith(root + sep) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404, { 'content-type': 'application/json' }).end('{"error":"not found"}')
    return
  }
  const immutable = path.replace(/\\/g, '/').startsWith('packages/')
  res.writeHead(200, {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-store',
    ...(extname(file) === '.html' ? { 'content-security-policy': STORY_CSP, 'referrer-policy': 'no-referrer' } : {}),
  })
  res.end(readFileSync(file))
})

server.listen(PORT, () => {
  const reg = loadRegistry()
  console.log(`story host  → http://localhost:${PORT}  (${reg.stories.length} stories, admin token: ${ADMIN_TOKEN === 'dev-admin' ? 'dev-admin (dev only)' : 'set'})`)
})

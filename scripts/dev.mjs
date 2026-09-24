#!/usr/bin/env node
/* Two-origin dev: story host on :4174 (content plane), Vite on :5173
   (application plane) — the same separation production uses. */
import { spawn } from 'node:child_process'
const host = spawn('node', ['infra/story-host/server.mjs'], { stdio: 'inherit' })
const web = spawn('npm', ['--workspace', 'apps/web', 'run', 'dev'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_STORY_ORIGIN: 'http://localhost:4174' },
})
const stop = () => { host.kill(); web.kill(); process.exit(0) }
process.on('SIGINT', stop); process.on('SIGTERM', stop)

#!/usr/bin/env node
/* Two-origin dev: story host on :4174 (content plane), Vite on :5173
   (application plane) — the same separation production uses.
   Works from PowerShell, cmd, and WSL: on Windows `npm` is `npm.cmd`,
   which Node can only spawn through a shell. */
import { spawn } from 'node:child_process'

const win = process.platform === 'win32'
const host = spawn(process.execPath, ['infra/story-host/server.mjs'], { stdio: 'inherit' })
const web = spawn(win ? 'npm.cmd' : 'npm', ['--workspace', 'apps/web', 'run', 'dev'], {
  stdio: 'inherit',
  shell: win,
  env: { ...process.env, VITE_STORY_ORIGIN: process.env.VITE_STORY_ORIGIN || 'http://localhost:4174' },
})
const stop = () => { host.kill(); web.kill(); process.exit(0) }
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
web.on('exit', (code) => { host.kill(); process.exit(code ?? 0) })

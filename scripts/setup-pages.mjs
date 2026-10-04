#!/usr/bin/env node
/* GitHub Pages setup from a terminal — the same checklist and fixes as the
   Studio's Hosting page (@storyframe/publishing → inspectHosting/fixHosting).

     GITHUB_TOKEN=github_pat_… npm run setup:pages -- owner/name          # check
     GITHUB_TOKEN=github_pat_… npm run setup:pages -- owner/name --fix    # and fix

   The repository defaults to the "origin" remote. The token needs Contents,
   Actions, Pages, and Administration (write) for that one repository; the
   check prints a pre-filled link to create exactly that token. */
import { spawnSync } from 'node:child_process'
import { inspectHosting, fixHosting, tokenLinks } from '../packages/publishing/src/github-hosting.js'

const args = process.argv.slice(2)
const fix = args.includes('--fix')
let repo = args.find((a) => /^[\w.-]+\/[\w.-]+$/.test(a))
if (!repo) {
  const url = spawnSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8', shell: process.platform === 'win32' }).stdout?.trim() ?? ''
  repo = /github\.com[/:]([\w.-]+\/[\w.-]+?)(?:\.git)?$/.exec(url)?.[1]
}
if (!repo) { console.error('Which repository? npm run setup:pages -- owner/name [--fix]'); process.exit(1) }
const [owner, name] = repo.split('/')
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
if (!token) {
  console.error(`Set GITHUB_TOKEN first. Create a one-day setup token here (pre-filled):\n\n  ${tokenLinks({ owner, repo: name }).setup}\n\nChoose "Only select repositories" → ${name}.`)
  process.exit(1)
}

const api = async (method, path, body) => {
  const res = await fetch('https://api.github.com' + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  let data = null
  try { data = res.status === 204 ? null : await res.json() } catch { /* empty */ }
  return { status: res.status, data }
}
const MARK = { done: '✓', todo: '!', working: '…', blocked: '✕', info: 'i' }
const show = (r) => { for (const s of r.steps) console.log(`  ${MARK[s.state] ?? '·'} ${s.title}\n      ${s.detail}${s.state !== 'done' && s.needs ? `\n      token permission: ${s.needs}` : ''}`) }

let report = await inspectHosting(api, repo)
if (report.error) { console.error(`GitHub: ${report.error}`); process.exit(1) }
console.log(`\nGitHub Pages for ${repo}\n`)
show(report)
if (fix && report.steps.some((s) => s.fixable)) {
  console.log('\nFixing…')
  try {
    await fixHosting(api, report, (s) => s.state !== 'working' && console.log(`  ${s.state === 'done' ? '✓' : '✕'} ${s.detail}`))
  } catch (e) { console.error(`\n${e.message}`); process.exitCode = 1 }
  report = await inspectHosting(api, repo)
  console.log('')
  show(report)
} else if (!fix && report.steps.some((s) => s.fixable)) {
  console.log('\nRun again with --fix to do the steps marked "!".')
}
console.log(`\nReader app:  ${report.url}\nStudio:      ${report.url}#/admin/connect\nAdd a book:  ${report.url}#/add\n${report.ok ? '' : '(live once the deployment finishes — about two minutes)\n'}`)

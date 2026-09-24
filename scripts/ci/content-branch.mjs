#!/usr/bin/env node
/* The content plane lives on its own branch (`content`) so immutable
   releases survive every CI run (ADR-0005). This script checks that branch
   out as a git worktree at infra/story-host/stories-host/ — or creates it as
   an orphan branch the first time — and later commits + pushes it.

     node scripts/ci/content-branch.mjs checkout
     node scripts/ci/content-branch.mjs commit "message"
     node scripts/ci/content-branch.mjs init      # local: seed the branch from your published tree

   Worktrees share the main checkout's git config, so the credentials that
   actions/checkout configured also authorise the push. */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, cpSync, rmSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { DEFAULT_HOST_DIR, REPO } from '../../packages/story-cli/src/lib.mjs'

const HOST = process.env.STORYFRAME_HOST_DIR || DEFAULT_HOST_DIR
const BRANCH = process.env.STORYFRAME_CONTENT_BRANCH || 'content'
const git = (args, opts = {}) => {
  const r = spawnSync('git', args, { cwd: opts.cwd ?? REPO, encoding: 'utf8', shell: process.platform === 'win32' })
  if (opts.check !== false && r.status !== 0) {
    console.error(`git ${args.join(' ')} failed:\n${r.stderr || r.stdout}`)
    process.exit(1)
  }
  return r
}
const identity = ['-c', 'user.name=storyframe-ci', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com']
const remoteHas = () => git(['ls-remote', '--exit-code', '--heads', 'origin', BRANCH], { check: false }).status === 0

function checkout() {
  if (existsSync(join(HOST, '.git'))) { console.log(`content worktree already at ${HOST}`); return }
  if (existsSync(HOST) && readdirSync(HOST).length) {
    console.error(`${HOST} exists and is not a worktree — move it away (it is generated) and retry`)
    process.exit(1)
  }
  if (remoteHas()) {
    git(['fetch', '--no-tags', '--depth=1', 'origin', `+refs/heads/${BRANCH}:refs/remotes/origin/${BRANCH}`])
    git(['worktree', 'add', '-B', BRANCH, HOST, `origin/${BRANCH}`])
    console.log(`checked out ${BRANCH} → ${HOST}`)
  } else {
    // first run: an orphan branch that shares no history with main
    git(['worktree', 'add', '--detach', HOST])
    git(['checkout', '--orphan', BRANCH], { cwd: HOST })
    git(['rm', '-rf', '--quiet', '.'], { cwd: HOST, check: false })
    for (const name of readdirSync(HOST)) if (name !== '.git') rmSync(join(HOST, name), { recursive: true, force: true })
    console.log(`created orphan branch ${BRANCH} at ${HOST} (first publish)`)
  }
}

function commit(message) {
  git(['add', '-A'], { cwd: HOST })
  const dirty = git(['status', '--porcelain'], { cwd: HOST }).stdout.trim()
  if (!dirty) { console.log('content unchanged — nothing to commit'); return false }
  git([...identity, 'commit', '-q', '-m', message], { cwd: HOST })
  git(['push', 'origin', `HEAD:refs/heads/${BRANCH}`], { cwd: HOST })
  console.log(`pushed ${BRANCH}: ${message}`)
  return true
}

function init() {
  // seed the branch from a locally published tree (DEPLOY.md, optional)
  if (remoteHas()) { console.error(`origin/${BRANCH} already exists — nothing to seed`); process.exit(1) }
  const stash = existsSync(HOST) ? mkdtempSync(join(tmpdir(), 'sf-content-')) : null
  if (stash) { cpSync(HOST, stash, { recursive: true }); rmSync(HOST, { recursive: true, force: true }) }
  checkout()
  if (stash) { cpSync(stash, HOST, { recursive: true, filter: (p) => !/[\\/]\.git([\\/]|$)/.test(p) }); rmSync(stash, { recursive: true, force: true }) }
  commit('content: seed from local publish')
}

const [cmd, ...rest] = process.argv.slice(2)
if (cmd === 'checkout') checkout()
else if (cmd === 'commit') commit(rest.join(' ') || 'content: update')
else if (cmd === 'init') init()
else { console.log('usage: content-branch.mjs checkout | commit "<message>" | init'); process.exit(1) }

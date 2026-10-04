/* GitHub Pages hosting: inspect a repo's state and fix it, against a fake
   GitHub that behaves like the real REST API (status codes included). */
import { describe, it, expect } from 'vitest'
import { inspectHosting, fixHosting, tokenLinks, pagesUrl } from '@storyframe/publishing'

function fakeGitHub(state) {
  const calls = []
  const api = async (method, path, body) => {
    calls.push(`${method} ${path}`)
    const R = '/repos/me/royal'
    if (method === 'GET' && path === R) return state.token === 'bad' ? { status: 401 } : { status: 200, data: { default_branch: state.defaultBranch, private: false, permissions: { push: state.push !== false, admin: true }, html_url: 'https://github.com/me/royal' } }
    const ref = /^\/repos\/me\/royal\/git\/ref\/heads\/(.+)$/.exec(path)
    if (method === 'GET' && ref) { const b = decodeURIComponent(ref[1]); return state.branches[b] ? { status: 200, data: { object: { sha: state.branches[b] } } } : { status: 404 } }
    if (method === 'GET' && path === `${R}/pages`) return state.pages === 'forbidden' ? { status: 403 } : state.pages ? { status: 200, data: { build_type: state.pages, html_url: 'https://me.github.io/royal/' } } : { status: 404 }
    if (method === 'GET' && path.startsWith(`${R}/actions/workflows/pages.yml/runs`)) return { status: 200, data: { workflow_runs: state.runs ?? [] } }
    if (method === 'GET' && path.startsWith(`${R}/contents/.github/workflows/pages.yml`)) return state.workflow === false ? { status: 404 } : { status: 200, data: {} }
    if (method === 'POST' && path === `${R}/git/refs`) { state.branches.main = body.sha; return { status: 201 } }
    if (method === 'PATCH' && path === R) { if (state.noAdmin) return { status: 403 }; state.defaultBranch = body.default_branch; return { status: 200 } }
    if (method === 'POST' && path === `${R}/pages`) { state.pages = body.build_type; return { status: 201 } }
    if (method === 'PUT' && path === `${R}/pages`) { state.pages = body.build_type; return { status: 204 } }
    if (method === 'POST' && path === `${R}/actions/workflows/pages.yml/dispatches`) { state.runs = [{ status: 'queued', conclusion: null }]; return { status: 204 } }
    return { status: 404 }
  }
  return { api, calls, state }
}
const fresh = () => fakeGitHub({ defaultBranch: 'claude/new-session', branches: { 'claude/new-session': 'abc1234def' }, pages: null, runs: [] })

describe('inspectHosting', () => {
  it('explains a fresh repository step by step', async () => {
    const { api } = fresh()
    const r = await inspectHosting(api, 'me/royal')
    expect(r.ok).toBe(false)
    expect(Object.fromEntries(r.steps.map((s) => [s.id, s.state]))).toEqual({ repo: 'done', main: 'todo', default: 'todo', workflow: 'done', pages: 'todo', deploy: 'todo', content: 'info' })
    expect(r.url).toBe('https://me.github.io/royal/')
    expect(r.steps.find((s) => s.id === 'default').needs).toMatch(/Administration/)
  })
  it('reports a finished setup as ok', async () => {
    const { api } = fakeGitHub({ defaultBranch: 'main', branches: { main: 'aaa', content: 'bbb' }, pages: 'workflow', runs: [{ status: 'completed', conclusion: 'success', html_url: 'u' }] })
    const r = await inspectHosting(api, 'me/royal')
    expect(r.ok).toBe(true)
    expect(r.steps.every((s) => s.state === 'done')).toBe(true)
  })
  it('says why when the token cannot do something', async () => {
    expect((await inspectHosting(fakeGitHub({ token: 'bad', branches: {} }).api, 'me/royal')).error).toBe('bad-token')
    const r = await inspectHosting(fakeGitHub({ defaultBranch: 'main', branches: { main: 'a' }, pages: 'forbidden', push: false }).api, 'me/royal')
    expect(r.steps.find((s) => s.id === 'repo').state).toBe('blocked')
    expect(r.steps.find((s) => s.id === 'pages')).toMatchObject({ state: 'blocked', fixable: false })
    expect((await inspectHosting(fresh().api, 'not a repo')).error).toBe('repo-format')
  })
  it('treats a branch-based Pages site as something to switch, and a missing workflow as blocking', async () => {
    const r = await inspectHosting(fakeGitHub({ defaultBranch: 'main', branches: { main: 'a' }, pages: 'legacy', workflow: false }).api, 'me/royal')
    expect(r.steps.find((s) => s.id === 'pages')).toMatchObject({ state: 'todo', fixable: true })
    expect(r.steps.find((s) => s.id === 'workflow').state).toBe('blocked')
  })
})

describe('fixHosting', () => {
  it('creates main from the same commit, makes it default, turns Pages on, and deploys — in that order', async () => {
    const gh = fresh()
    const report = await inspectHosting(gh.api, 'me/royal')
    const seen = []
    const out = await fixHosting(gh.api, report, (s) => seen.push(`${s.id}:${s.state}`))
    expect(out.done).toEqual(['main', 'default', 'pages', 'deploy'])
    expect(gh.state.branches.main).toBe('abc1234def')
    expect(gh.state.defaultBranch).toBe('main')
    expect(gh.state.pages).toBe('workflow')
    expect(seen.filter((s) => s.endsWith(':done'))).toHaveLength(4)
    expect(gh.calls.filter((c) => !c.startsWith('GET'))).toEqual([
      'POST /repos/me/royal/git/refs', 'PATCH /repos/me/royal', 'POST /repos/me/royal/pages', 'POST /repos/me/royal/actions/workflows/pages.yml/dispatches',
    ])
    const again = await inspectHosting(gh.api, 'me/royal')
    expect(again.steps.find((s) => s.id === 'deploy').state).toBe('working')
  })
  it('stops at the first refusal and names the missing permission', async () => {
    const gh = fakeGitHub({ defaultBranch: 'dev', branches: { dev: 'x', main: 'x' }, pages: null, noAdmin: true })
    const report = await inspectHosting(gh.api, 'me/royal')
    await expect(fixHosting(gh.api, report)).rejects.toThrow(/Administration/)
    expect(gh.state.pages).toBe(null)          // nothing after the refusal ran
  })
})

describe('links', () => {
  it('pre-fills tokens with exactly the permissions each job needs', () => {
    const l = tokenLinks({ owner: 'me', repo: 'royal' })
    expect(l.publishing).toMatch(/contents=write/)
    expect(l.publishing).toMatch(/actions=write/)
    expect(l.publishing).not.toMatch(/administration/)
    expect(l.setup).toMatch(/administration=write/)
    expect(l.setup).toMatch(/pages=write/)
    expect(l.setup).toMatch(/expires_in=1(&|$)/)
    expect(pagesUrl('Me', 'royal')).toBe('https://me.github.io/royal/')
    expect(pagesUrl('me', 'me.github.io')).toBe('https://me.github.io/')
  })
})

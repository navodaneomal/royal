/* Admin session. The GitHub token lives in sessionStorage ONLY — gone when
   the tab closes; never in IndexedDB, never in config.json, never sent to a
   story frame (frames are opaque or cross-origin and receive nothing but
   the bridge port). The repo name is not a secret, so it may persist. */
import { config } from './config'
import { storyBase } from './catalog'

const K = { gh: 'sf.admin.github', dev: 'sf.admin.dev', repo: 'sf.admin.repo', branch: 'sf.admin.branch' }
type Listener = () => void
const listeners = new Set<Listener>()
const emit = () => listeners.forEach((fn) => fn())
export const onAdminChange = (fn: Listener) => { listeners.add(fn); return () => listeners.delete(fn) }

const ss = {
  get: (k: string) => { try { return sessionStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string | null) => { try { v === null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v) } catch { /* private mode */ } },
}
const ls = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string | null) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v) } catch { /* private mode */ } },
}

export function adminSession() {
  return {
    githubToken: ss.get(K.gh),
    devToken: ss.get(K.dev),
    repo: config().githubRepo ?? ls.get(K.repo) ?? '',
    repoFromConfig: !!config().githubRepo,
    branch: config().githubBranch ?? ls.get(K.branch) ?? 'main',
    workflow: config().publishWorkflow ?? 'publish.yml',
  }
}
export const hasAdminToken = () => { const s = adminSession(); return !!(s.githubToken || s.devToken) }
export function setGithubToken(token: string | null) { ss.set(K.gh, token && token.trim() ? token.trim() : null); emit() }
export function setDevToken(token: string | null) { ss.set(K.dev, token && token.trim() ? token.trim() : null); emit() }
export function setRepo(repo: string, branch?: string) { ls.set(K.repo, repo.trim() || null); if (branch) ls.set(K.branch, branch.trim()); emit() }
export function signOutAdmin() { ss.set(K.gh, null); ss.set(K.dev, null); emit() }

/** Is the dev story host's admin API reachable? (only in `npm run dev`) */
export async function probeDevAdmin(): Promise<boolean> {
  // Only the dev story host answers this with JSON; static hosts return 405
  // or their HTML fallback (200), which must NOT count as an admin API.
  try {
    const res = await fetch(storyBase() + '/admin/ping', { method: 'POST', headers: { 'x-admin-token': 'probe' } })
    if (!(res.headers.get('content-type') ?? '').includes('json')) return false
    const body = await res.json().catch(() => null)
    return (res.status === 401 && body?.error === 'unauthorized') || (res.status === 200 && body?.mode === 'dev-admin-api')
  } catch { return false }
}

export async function devAdmin(action: string, body: Record<string, unknown>) {
  const token = adminSession().devToken ?? 'dev-admin'
  const res = await fetch(`${storyBase()}/admin/${action}`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-token': token }, body: JSON.stringify(body),
  })
  return res.json()
}

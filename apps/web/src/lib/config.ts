/* Runtime configuration (ADR-0008).

   The deployed app reads /config.json at boot, so a drag-and-drop bundle can
   be re-pointed at another story origin — or given Supabase / GitHub
   settings — without rebuilding. VITE_STORY_ORIGIN (build time) still wins
   when set, which is how `npm run dev` points at the local story host.

   config.json is PUBLIC (it ships with the app). Anything that looks like a
   secret is refused here, loudly; the Admin Studio's GitHub token lives only
   in sessionStorage (see lib/admin.ts). */

export type RuntimeConfig = {
  storyOrigin: string              // absolute origin, or a same-origin path like /stories-host
  supabaseUrl?: string
  supabaseAnonKey?: string
  githubRepo?: string              // owner/name — enables the Admin Studio's publish + operator actions
  githubBranch?: string            // source branch the Admin commits to (default main)
  publishWorkflow?: string         // workflow file (default publish.yml)
}

export type ResolvedConfig = {
  config: RuntimeConfig
  source: 'env' | 'config.json' | 'default'
  warnings: string[]
}

export const DEFAULT_STORY_ORIGIN = '/stories-host'
const SECRET_KEYS = /token|secret|pat$|password|service.?role|private/i

/** Pure: merge config.json with the build-time env override. Tested in tests/app/config.test.ts. */
export function resolveConfig(json: unknown, env: { VITE_STORY_ORIGIN?: string } = {}): ResolvedConfig {
  const warnings: string[] = []
  const raw = (json && typeof json === 'object' && !Array.isArray(json)) ? json as Record<string, unknown> : {}
  if (json !== null && json !== undefined && raw !== json) warnings.push('config.json is not an object — using defaults')

  for (const key of Object.keys(raw)) {
    if (SECRET_KEYS.test(key) && key !== 'supabaseAnonKey') warnings.push(`config.json key "${key}" looks like a secret and was ignored — config.json is public`)
  }

  const validOrigin = (v: unknown): v is string =>
    typeof v === 'string' && (/^https?:\/\/[^/\s]+(\/[^\s]*)?$/i.test(v) || /^\/[\w./-]*$/.test(v))

  let storyOrigin = DEFAULT_STORY_ORIGIN
  let source: ResolvedConfig['source'] = 'default'
  if (raw.storyOrigin !== undefined) {
    if (typeof raw.storyOrigin === 'string' && /YOUR-|example\.invalid/i.test(raw.storyOrigin)) {
      warnings.push('config.json storyOrigin is still the placeholder — edit it (DEPLOY.md) or use the single-origin bundle')
    } else if (validOrigin(raw.storyOrigin)) {
      storyOrigin = raw.storyOrigin
      source = 'config.json'
    } else warnings.push('config.json storyOrigin must be an http(s) URL or a /path — using ' + DEFAULT_STORY_ORIGIN)
  }
  if (env.VITE_STORY_ORIGIN && validOrigin(env.VITE_STORY_ORIGIN)) { storyOrigin = env.VITE_STORY_ORIGIN; source = 'env' }

  const config: RuntimeConfig = { storyOrigin: storyOrigin.replace(/\/+$/, '') || DEFAULT_STORY_ORIGIN }

  const url = raw.supabaseUrl, key = raw.supabaseAnonKey
  if (url !== undefined || key !== undefined) {
    if (typeof url === 'string' && /^(https:\/\/[\w.-]+|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)\/?$/.test(url) && typeof key === 'string' && key.length > 20) {
      config.supabaseUrl = url.replace(/\/$/, '')
      config.supabaseAnonKey = key
    } else warnings.push('Supabase needs both supabaseUrl (https) and supabaseAnonKey — cloud sync stays off')
  }
  if (typeof raw.githubRepo === 'string' && raw.githubRepo) {
    if (/^[\w.-]+\/[\w.-]+$/.test(raw.githubRepo)) config.githubRepo = raw.githubRepo
    else warnings.push('githubRepo must look like owner/name')
  }
  if (typeof raw.githubBranch === 'string' && /^[\w./-]+$/.test(raw.githubBranch)) config.githubBranch = raw.githubBranch
  if (typeof raw.publishWorkflow === 'string' && /^[\w.-]+\.ya?ml$/.test(raw.publishWorkflow)) config.publishWorkflow = raw.publishWorkflow
  return { config, source, warnings }
}

let current: ResolvedConfig = resolveConfig(null, (import.meta as any).env ?? {})

/** Fetch /config.json once at boot (3 s budget; offline boot uses the SW-cached copy or defaults). */
export async function loadConfig(): Promise<ResolvedConfig> {
  let json: unknown = null
  try {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), 3000)
    const res = await fetch('/config.json', { cache: 'no-cache', signal: ctl.signal })
    clearTimeout(timer)
    if (res.ok && (res.headers.get('content-type') ?? '').includes('json')) json = await res.json()
  } catch { /* no config.json — defaults */ }
  current = resolveConfig(json, (import.meta as any).env ?? {})
  for (const w of current.warnings) console.warn('[storyframe config]', w)
  return current
}

export const config = () => current.config
export const configInfo = () => current

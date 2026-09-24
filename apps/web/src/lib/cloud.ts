/* Cloud sync — the optional Supabase adapter (ADR-0002, STATUS P0.15 📦).

   Off unless /config.json carries supabaseUrl + supabaseAnonKey. Local-first
   stays the rule: every commit lands in IndexedDB first (store.ts), then is
   pushed to the `progress-commit` edge function, which runs THE SAME
   reducer before a single-transaction RPC. Nothing here pretends: the UI
   only says "synced" after the server acknowledged a revision.

   Guest → account upgrade: each local primary timeline is sent to
   `progress-import` (mode "upgrade"); the account's timeline stays
   canonical, the guest's discoveries are union-merged (planImport in the
   shared reducer), and the guest snapshot is archived — never lost.
   Cross-device conflict: a stale push comes back 409; the other device's
   snapshot is archived locally as a divergence and the reader chooses. */
import { config } from './config'
import { getKv, setKv, primaryProgress, getProgress } from './store'
import { put } from './idb'

export const cloudEnabled = () => !!(config().supabaseUrl && config().supabaseAnonKey)

let clientPromise: Promise<any> | null = null
export function client() {
  if (!cloudEnabled()) throw new Error('cloud sync is not configured')
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(config().supabaseUrl!, config().supabaseAnonKey!, {
      auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true, storageKey: 'sf-auth' },
    }))
  return clientPromise
}

export async function currentUser() {
  const sb = await client()
  const { data } = await sb.auth.getSession()
  if (location.search.includes('code=')) history.replaceState(null, '', location.pathname + location.hash)
  return data.session?.user ?? null
}
export async function sendMagicLink(email: string) {
  const sb = await client()
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } })
  if (error) throw error
}
export async function signOut() { const sb = await client(); await sb.auth.signOut() }

async function callFunction(name: string, body: unknown) {
  const sb = await client()
  const { data } = await sb.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('not signed in')
  const res = await fetch(`${config().supabaseUrl}/functions/v1/${name}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, apikey: config().supabaseAnonKey!, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
}

type Link = { serverTimelineId: string; revision: number }
const links = async () => (await getKv<Record<string, Link>>('cloud.links', {})) ?? {}
const saveLink = async (localId: string, link: Link) => setKv('cloud.links', { ...(await links()), [localId]: link })

/** Guest → account: import every local primary timeline. */
export async function upgradeGuest(onEvent?: (msg: string) => void) {
  let done = 0
  for (const { timeline, progress } of await primaryProgress()) {
    const r = await callFunction('progress-import', {
      storyId: timeline.storyId, releaseId: progress.releaseId, snapshot: progress.snapshot, mode: 'upgrade',
    })
    if (r.status !== 200) { onEvent?.(`Could not sync one story (${r.json?.error ?? r.status})`); continue }
    await saveLink(timeline.id, { serverTimelineId: r.json.timelineId, revision: r.json.revision })
    if (r.json.action === 'merge' || r.json.action === 'unchanged') {
      // adopt the account's canonical snapshot locally as a new revision
      const cur = await getProgress(timeline.id)
      if (cur && JSON.stringify(cur.snapshot) !== JSON.stringify(r.json.snapshot)) {
        await put('progress', timeline.id, { ...cur, revision: cur.revision + 1, snapshot: r.json.snapshot, updatedAt: new Date().toISOString() })
      }
    }
    done += 1
  }
  await setKv('cloud.upgradedAt', new Date().toISOString())
  return { done }
}

/**
 * Push one locally-accepted operation. Returns 'synced', 'queued' (offline /
 * not linked yet), or a conflict carrying the other device's snapshot.
 */
export async function pushOperation(localTimelineId: string, op: { storyId: string; releaseId: string; operationId: string; mutation: unknown }) {
  if (!cloudEnabled() || !navigator.onLine) return { result: 'queued' as const }
  const link = (await links())[localTimelineId]
  if (!link) return { result: 'queued' as const }
  const r = await callFunction('progress-commit', { ...op, timelineId: link.serverTimelineId, baseRevision: link.revision })
  if (r.status === 200) { await saveLink(localTimelineId, { ...link, revision: r.json.revision }); return { result: 'synced' as const, revision: r.json.revision } }
  if (r.status === 409 && r.json.status === 'conflict') {
    const sb = await client()
    const { data } = await sb.from('reader_progress').select('revision, snapshot').eq('timeline_id', link.serverTimelineId).maybeSingle()
    return { result: 'conflict' as const, server: data }
  }
  return { result: 'error' as const, detail: r.json?.error ?? String(r.status) }
}

/** "Keep this device's timeline" after a cross-device conflict. */
export async function keepThisDevice(localTimelineId: string, storyId: string, releaseId: string) {
  const p = await getProgress(localTimelineId)
  if (!p) return
  const r = await callFunction('progress-import', { storyId, releaseId, snapshot: p.snapshot, mode: 'replace' })
  if (r.status === 200) await saveLink(localTimelineId, { serverTimelineId: r.json.timelineId, revision: r.json.revision })
}

/** "Use the other device's timeline": the local copy already adopted it; record the server revision. */
export async function adoptServer(localTimelineId: string, revision: number) {
  const link = (await links())[localTimelineId]
  if (link) await saveLink(localTimelineId, { ...link, revision })
}

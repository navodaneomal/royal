/* Product events (§24): consent-gated, allowlisted names, no narrative
   content, no identities. Stored locally in a ring buffer the operator
   console reads; a provider adapter would drain the same buffer. */
import { all, put, db } from './idb'
import { profile } from './store'

const ALLOWED = new Set([
  'story_impression', 'story_launch_requested', 'bridge_ready', 'meaningful_interaction',
  'checkpoint_committed', 'progress_conflict_detected', 'story_session_closed',
  'ending_reached', 'hint_offered', 'hint_accepted', 'offline_download_completed',
  'story_runtime_error', 'bridge_hello_rejected', 'bridge_invalid_message',
  'bridge_handshake_timeout', 'bridge_closed', 'capability_denied', 'commit_failed',
])
const MAX_EVENTS = 600

export async function track(name: string, props: Record<string, any> = {}) {
  if (!ALLOWED.has(name)) return
  const p = await profile().catch(() => null)
  // operational bridge events are essential (§24.1); product events need consent
  const essential = name.startsWith('bridge_') || name === 'story_runtime_error' || name === 'commit_failed'
  if (!essential && !p?.analyticsConsent) return
  const clean: Record<string, any> = {}
  for (const [k, v] of Object.entries(props)) {
    if (['string', 'number', 'boolean'].includes(typeof v) && String(v).length <= 120) clean[k] = v
  }
  await put('telemetry', undefined, { name, props: clean, at: new Date().toISOString() })
  const d = await db()
  const tx = d.transaction('telemetry', 'readwrite')
  const store = tx.objectStore('telemetry')
  const countReq = store.count()
  countReq.onsuccess = () => {
    if (countReq.result > MAX_EVENTS) {
      const cursor = store.openCursor()
      let toDelete = countReq.result - MAX_EVENTS
      cursor.onsuccess = () => {
        const c = cursor.result
        if (c && toDelete > 0) { c.delete(); toDelete -= 1; c.continue() }
      }
    }
  }
}

export async function telemetrySummary() {
  const rows = await all('telemetry')
  const byName: Record<string, number> = {}
  for (const r of rows) byName[r.value.name] = (byName[r.value.name] ?? 0) + 1
  return { total: rows.length, byName, recent: rows.slice(-30).map((r) => r.value).reverse() }
}

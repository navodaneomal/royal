/* The local-first data plane (§15).
   This module is the application's only authority for reader state. It
   implements the same contract the Supabase adapter implements server-side
   (see supabase/functions/progress-commit): idempotent operations, base-
   revision conflict detection, rolling snapshot backups, and archived
   conflicts — all inside single IndexedDB transactions. */
import { get, put, del, all, atomically, reqp, wipeAll } from './idb'
import {
  applyMutation, buildRegistry, emptySnapshot, defaultPreferences, PreferencesSchema,
  SNAPSHOT_RETENTION,
} from '@storyframe/protocol'

const uuid = () => crypto.randomUUID()

/* ── identity: guest-first (§18) ────────────────────────────────────── */
export async function profile() {
  let p = await get('profile', 'me')
  if (!p) {
    p = { id: 'guest-' + uuid(), createdAt: new Date().toISOString(), analyticsConsent: false, mode: 'guest' }
    await put('profile', 'me', p)
  }
  return p
}
export async function setConsent(consent: boolean) {
  const p = await profile()
  p.analyticsConsent = consent
  await put('profile', 'me', p)
}

/* ── preferences (§20.2) ────────────────────────────────────────────── */
const prefListeners = new Set<(p: any) => void>()
export async function getPreferences() {
  const raw = await get('preferences', 'me')
  return PreferencesSchema.parse(raw ?? {})
}
export async function setPreferences(next: any) {
  const parsed = PreferencesSchema.parse(next)
  await put('preferences', 'me', parsed)
  prefListeners.forEach((fn) => fn(parsed))
  return parsed
}
export function onPreferencesChange(fn: (p: any) => void) {
  prefListeners.add(fn)
  return () => prefListeners.delete(fn)
}
export { defaultPreferences }

/* ── timelines ──────────────────────────────────────────────────────── */
export async function primaryTimeline(storyId: string) {
  const rows = await all('timelines')
  let t = rows.map((r) => r.value).find((t: any) => t.storyId === storyId && t.isPrimary && !t.archivedAt)
  if (!t) {
    t = { id: 'tl-' + uuid(), storyId, name: 'Main timeline', isPrimary: true, createdAt: new Date().toISOString() }
    await put('timelines', t.id, t)
  }
  return t
}

export async function getProgress(timelineId: string) {
  return (await get('progress', timelineId)) ?? null
}

export async function allProgress() {
  const timelines = await all('timelines')
  const out: any[] = []
  for (const { value: t } of timelines) {
    const p = await get('progress', t.id)
    if (p) out.push({ timeline: t, progress: p })
  }
  return out.sort((a, b) => (b.progress.updatedAt ?? '').localeCompare(a.progress.updatedAt ?? ''))
}

/* ── the commit path (§15.2–15.5) ───────────────────────────────────── */
/**
 * Apply one atomic operation for a timeline.
 * Returns an ack payload shaped for PROGRESS_ACK.
 */
export async function commitOperation({ storyId, releaseId, manifest, timelineId, operationId, baseRevision, mutation }) {
  const registry = buildRegistry(manifest)

  return atomically(['progress', 'operations', 'backups', 'conflicts', 'archiveIndex', 'achievements'], async (tx) => {
    const ops = tx.objectStore('operations')
    const existing = await reqp(ops.get(operationId))
    if (existing) {
      // idempotency (§15.4): same operation returns its original result
      return { status: existing.status, sync: 'local', revision: existing.revision, replayed: true }
    }

    const progressStore = tx.objectStore('progress')
    const current = (await reqp(progressStore.get(timelineId))) ?? {
      revision: 0, snapshot: emptySnapshot(manifest), releaseId, storyId,
      completion: 'in_progress', startedAt: new Date().toISOString(),
    }

    if (baseRevision !== current.revision) {
      // §15.5: archive the losing snapshot, never silently overwrite
      const candidateResult = applyMutation(current.snapshot, mutation, registry)
      const at = new Date().toISOString()
      tx.objectStore('conflicts').put({
        timelineId, storyId, at, baseRevision, currentRevision: current.revision,
        candidate: candidateResult.ok ? candidateResult.snapshot : null,
        mutation, resolved: false,
      }, `${timelineId}:${at}`)
      ops.put({ status: 'conflict', revision: current.revision, timelineId, at }, operationId)
      return { status: 'conflict', sync: 'conflict', revision: current.revision }
    }

    const result = applyMutation(current.snapshot, mutation, registry)
    if (!result.ok) {
      ops.put({ status: 'rejected', revision: current.revision, timelineId, at: new Date().toISOString(), code: result.code }, operationId)
      return { status: 'rejected', sync: 'local', revision: current.revision, code: result.code }
    }

    const revision = current.revision + 1
    const now = new Date().toISOString()
    const nextRow = {
      ...current, revision, snapshot: result.snapshot, releaseId, storyId,
      updatedAt: now,
      completion: result.effects.ending ? 'completed' : current.completion,
      completedAt: result.effects.ending ? now : current.completedAt,
    }
    progressStore.put(nextRow, timelineId)
    ops.put({ status: 'accepted', revision, timelineId, at: now }, operationId)

    // rolling backups — last N confirmed snapshots (§15.5)
    tx.objectStore('backups').put({ snapshot: result.snapshot, revision, at: now }, `${timelineId}:${String(revision).padStart(8, '0')}`)
    const backups = tx.objectStore('backups')
    const range = IDBKeyRange.bound(`${timelineId}:`, `${timelineId}:￿`)
    const keys = await reqp(backups.getAllKeys(range))
    if (keys.length > SNAPSHOT_RETENTION) for (const k of keys.slice(0, keys.length - SNAPSHOT_RETENTION)) backups.delete(k)

    // cross-story surfaces (§6.7, P0.8) — written in the same transaction
    for (const itemId of result.effects.items) {
      tx.objectStore('archiveIndex').put(
        { discoveredAt: now, checkpointId: result.snapshot.checkpointId, timelineId, storyId, itemId },
        `${storyId}:${itemId}`,
      )
    }
    for (const achId of result.effects.achievements) {
      tx.objectStore('achievements').put({ unlockedAt: now, storyId, achId }, `${storyId}:${achId}`)
    }

    return { status: 'accepted', sync: navigator.onLine ? 'local' : 'offline-local', revision }
  })
}

/* ── conflict recovery (§7.4) ───────────────────────────────────────── */
export async function openConflicts(timelineId?: string) {
  const rows = await all('conflicts')
  return rows
    .map((r) => ({ key: r.key as string, ...r.value }))
    .filter((c) => !c.resolved && (!timelineId || c.timelineId === timelineId))
    .sort((a, b) => b.at.localeCompare(a.at))
}

export async function resolveConflict(key: string, choice: 'candidate' | 'current') {
  const c = await get('conflicts', key)
  if (!c) return
  if (choice === 'candidate' && c.candidate) {
    const cur = await get('progress', c.timelineId)
    const revision = (cur?.revision ?? 0) + 1
    const now = new Date().toISOString()
    await put('progress', c.timelineId, { ...cur, revision, snapshot: c.candidate, updatedAt: now })
    await put('backups', `${c.timelineId}:${String(revision).padStart(8, '0')}`, { snapshot: c.candidate, revision, at: now })
  }
  await put('conflicts', key, { ...c, resolved: true, resolution: choice, resolvedAt: new Date().toISOString() })
}

export async function listBackups(timelineId: string) {
  const rows = await all('backups')
  return rows.filter((r) => String(r.key).startsWith(timelineId + ':'))
    .map((r) => ({ key: r.key as string, ...r.value }))
    .sort((a, b) => b.revision - a.revision)
}

export async function restoreBackup(timelineId: string, key: string) {
  const b = await get('backups', key)
  if (!b) return
  const cur = await get('progress', timelineId)
  const revision = (cur?.revision ?? 0) + 1
  await put('progress', timelineId, { ...cur, revision, snapshot: b.snapshot, updatedAt: new Date().toISOString() })
}

/* ── archive + achievements views ───────────────────────────────────── */
export async function archiveEntries() { return (await all('archiveIndex')).map((r) => r.value) }
export async function achievementRows() { return (await all('achievements')).map((r) => r.value) }

/* ── downloads (offline, §15.7 + ADR-0003) ──────────────────────────── */
export async function saveDownload(releaseId: string, record: any) { await put('downloads', releaseId, record) }
export async function getDownload(releaseId: string) { return get('downloads', releaseId) }
export async function removeDownload(releaseId: string) { await del('downloads', releaseId) }
export async function allDownloads() { return all('downloads') }

/* ── privacy (§19.3) ────────────────────────────────────────────────── */
export async function exportEverything() {
  const dump: Record<string, any> = {}
  for (const s of ['profile', 'preferences', 'timelines', 'progress', 'operations', 'backups', 'conflicts', 'archiveIndex', 'achievements']) {
    dump[s] = await all(s)
  }
  return { exportedAt: new Date().toISOString(), application: 'storyframe', dump }
}
export async function deleteEverything() { await wipeAll() }

/* ── registry cache for offline boot ────────────────────────────────── */
export async function cacheRegistry(reg: any) { await put('kv', 'registry', { reg, at: Date.now() }) }
export async function cachedRegistry() { return (await get('kv', 'registry'))?.reg ?? null }

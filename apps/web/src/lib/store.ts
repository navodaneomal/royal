/* The local-first data plane (§15).
   This module is the application's only authority for reader state. It
   implements the same contract the Supabase adapter implements server-side
   (see supabase/functions/progress-commit): idempotent operations, base-
   revision conflict detection, rolling snapshot backups, and archived
   conflicts — all inside single IndexedDB transactions.

   v2 additions: snapshot migration on resume (the manifest's migration map,
   applied by the shared reducer), a per-timeline checkpoint ledger that
   makes "replay from a checkpoint" possible without flipping any canonical
   choice on the original timeline, notes & bookmarks (protocol 1.1), and
   separate beta timelines so previewing a beta never touches real progress. */
import { get, put, del, all, atomically, reqp, wipeAll } from './idb'
import {
  applyMutation, buildRegistry, emptySnapshot, defaultPreferences, PreferencesSchema,
  SNAPSHOT_RETENTION, migrateSnapshot,
} from '@storyframe/protocol'

const uuid = () => crypto.randomUUID()
const nowIso = () => new Date().toISOString()

/* ── identity: guest-first (§18) ────────────────────────────────────── */
export async function profile() {
  let p = await get('profile', 'me')
  if (!p) {
    p = { id: 'guest-' + uuid(), createdAt: nowIso(), analyticsConsent: false, mode: 'guest' }
    await put('profile', 'me', p)
  }
  return p
}
export async function updateProfile(patch: Record<string, unknown>) {
  const p = { ...(await profile()), ...patch }
  await put('profile', 'me', p)
  return p
}
export async function setConsent(consent: boolean) { return updateProfile({ analyticsConsent: consent }) }

/* ── small settings (kv) ────────────────────────────────────────────── */
export async function getKv<T = any>(key: string, fallback?: T): Promise<T> {
  const v = await get('kv', key)
  return (v === undefined ? fallback : v) as T
}
export async function setKv(key: string, value: unknown) { await put('kv', key, value) }

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
export type Channel = 'production' | 'beta'
const channelOf = (t: any): Channel => (t.channel === 'beta' ? 'beta' : 'production')

export async function timelinesFor(storyId: string, channel: Channel = 'production') {
  const rows = await all('timelines')
  return rows.map((r) => r.value).filter((t: any) => t.storyId === storyId && channelOf(t) === channel)
    .sort((a: any, b: any) => a.createdAt.localeCompare(b.createdAt))
}

export async function primaryTimeline(storyId: string, channel: Channel = 'production') {
  const list = await timelinesFor(storyId, channel)
  let t = list.find((x: any) => x.isPrimary && !x.archivedAt)
  if (!t) {
    t = {
      id: 'tl-' + uuid(), storyId, name: channel === 'beta' ? 'Beta preview' : 'Main timeline',
      isPrimary: true, createdAt: nowIso(), ...(channel === 'beta' ? { channel } : {}),
    }
    await put('timelines', t.id, t)
  }
  return t
}

export async function setPrimaryTimeline(timelineId: string) {
  const target = await get('timelines', timelineId)
  if (!target) return
  for (const t of await timelinesFor(target.storyId, channelOf(target))) {
    const isPrimary = t.id === timelineId
    if (t.isPrimary !== isPrimary) await put('timelines', t.id, { ...t, isPrimary })
  }
}

export async function renameTimeline(timelineId: string, name: string) {
  const t = await get('timelines', timelineId)
  if (t) await put('timelines', timelineId, { ...t, name: name.slice(0, 60) || t.name })
}

export async function getProgress(timelineId: string) {
  return (await get('progress', timelineId)) ?? null
}

export async function allProgress() {
  const timelines = await all('timelines')
  const out: any[] = []
  for (const { value: t } of timelines) {
    if (channelOf(t) !== 'production') continue
    const p = await get('progress', t.id)
    if (p) out.push({ timeline: t, progress: p })
  }
  return out.sort((a, b) => (b.progress.updatedAt ?? '').localeCompare(a.progress.updatedAt ?? ''))
}

/** Progress of each story's PRIMARY production timeline, newest first. */
export async function primaryProgress() {
  return (await allProgress()).filter((x) => x.timeline.isPrimary)
}

/* ── resume on a newer release (v2) ─────────────────────────────────── */
/**
 * Before bootstrap: if the reader's snapshot was saved under an older
 * stateSchemaVersion, migrate it with the release's migration map and store
 * the result as a NEW revision (the old snapshot stays in the backup ring).
 * Returns what to bootstrap the story with.
 */
export async function prepareResume(timelineId: string, manifest: any, releaseId: string) {
  const current = await getProgress(timelineId)
  if (!current) return { progress: null, migrated: false as const }
  const from = current.snapshot?.stateSchemaVersion ?? manifest.stateSchemaVersion
  if (from === manifest.stateSchemaVersion) return { progress: current, migrated: false as const }
  const r = migrateSnapshot(current.snapshot, manifest)
  if (!r.ok) return { progress: current, migrated: false as const, error: r.code as string, detail: r.detail as string }
  const revision = current.revision + 1
  const at = nowIso()
  const next = { ...current, revision, snapshot: r.snapshot, releaseId, updatedAt: at, migratedFrom: from }
  await atomically(['progress', 'backups'], async (tx) => {
    tx.objectStore('progress').put(next, timelineId)
    tx.objectStore('backups').put({ snapshot: r.snapshot, revision, at, note: `migrated from v${from}` }, `${timelineId}:${String(revision).padStart(8, '0')}`)
  })
  return { progress: next, migrated: true as const, from }
}

/* ── the commit path (§15.2–15.5) ───────────────────────────────────── */
/**
 * Apply one atomic operation for a timeline.
 * Returns an ack payload shaped for PROGRESS_ACK.
 */
export async function commitOperation({ storyId, releaseId, manifest, timelineId, operationId, baseRevision, mutation }: any) {
  const registry = buildRegistry(manifest)

  return atomically(['progress', 'operations', 'backups', 'conflicts', 'archiveIndex', 'achievements', 'checkpointSnaps'], async (tx) => {
    const ops = tx.objectStore('operations')
    const existing = await reqp(ops.get(operationId))
    if (existing) {
      // idempotency (§15.4): same operation returns its original result
      return { status: existing.status, sync: 'local', revision: existing.revision, replayed: true }
    }

    const progressStore = tx.objectStore('progress')
    const current = (await reqp(progressStore.get(timelineId))) ?? {
      revision: 0, snapshot: emptySnapshot(manifest), releaseId, storyId,
      completion: 'in_progress', startedAt: nowIso(),
    }

    if (baseRevision !== current.revision) {
      // §15.5: archive the losing snapshot, never silently overwrite
      const candidateResult = applyMutation(current.snapshot, mutation, registry)
      const at = nowIso()
      tx.objectStore('conflicts').put({
        timelineId, storyId, at, baseRevision, currentRevision: current.revision,
        candidate: candidateResult.ok ? candidateResult.snapshot : null,
        mutation, resolved: false,
      }, `${timelineId}:${at}`)
      ops.put({ status: 'conflict', revision: current.revision, timelineId, at }, operationId)
      return { status: 'conflict', sync: 'conflict', revision: current.revision }
    }

    // a snapshot from an older release schema is migrated before anything applies
    let base = current.snapshot
    if (base.stateSchemaVersion !== manifest.stateSchemaVersion) {
      const m = migrateSnapshot(base, manifest)
      if (!m.ok) {
        ops.put({ status: 'rejected', revision: current.revision, timelineId, at: nowIso(), code: m.code }, operationId)
        return { status: 'rejected', sync: 'local', revision: current.revision, code: m.code }
      }
      base = m.snapshot
    }

    const result = applyMutation(base, mutation, registry)
    if (!result.ok) {
      ops.put({ status: 'rejected', revision: current.revision, timelineId, at: nowIso(), code: result.code }, operationId)
      return { status: 'rejected', sync: 'local', revision: current.revision, code: result.code }
    }

    const revision = current.revision + 1
    const now = nowIso()
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

    // checkpoint ledger (v2): the first time a timeline reaches a checkpoint,
    // keep that snapshot — the reader can later replay from exactly here
    const snapKey = `${timelineId}:${result.snapshot.checkpointId}`
    const snaps = tx.objectStore('checkpointSnaps')
    if (!(await reqp(snaps.get(snapKey)))) snaps.put({ snapshot: result.snapshot, revision, at: now, storyId, timelineId }, snapKey)

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

/* ── replay: a new timeline from a checkpoint (v2) ──────────────────── */
export async function replayPoints(timelineId: string) {
  const rows = await all('checkpointSnaps')
  return rows.filter((r) => String(r.key).startsWith(timelineId + ':')).map((r) => ({ key: String(r.key), ...r.value }))
}

/**
 * Fork a new primary timeline starting at `checkpointId` (or at the very
 * beginning when null). The original timeline is left exactly as it was —
 * its canonical choices never change; the new one simply has not made the
 * choices that came after that checkpoint yet.
 */
export async function replayFromCheckpoint(storyId: string, fromTimelineId: string, checkpointId: string | null, label: string) {
  const origin = await get('timelines', fromTimelineId)
  const snap = checkpointId ? await get('checkpointSnaps', `${fromTimelineId}:${checkpointId}`) : null
  if (checkpointId && !snap) throw new Error('that checkpoint was never reached on this timeline')
  const at = nowIso()
  const t = {
    id: 'tl-' + uuid(), storyId, isPrimary: true, createdAt: at,
    name: checkpointId ? `Replay from “${label}”` : 'A fresh start',
    parentTimelineId: fromTimelineId, forkedAtCheckpoint: checkpointId,
    ...(origin?.channel === 'beta' ? { channel: 'beta' } : {}),
  }
  await put('timelines', t.id, t)
  if (snap) {
    const row = { revision: 1, snapshot: snap.snapshot, storyId, releaseId: null, completion: 'in_progress', startedAt: at, updatedAt: at, forkedFrom: fromTimelineId }
    await put('progress', t.id, row)
    await put('checkpointSnaps', `${t.id}:${checkpointId}`, { ...snap, timelineId: t.id, at })
    await put('backups', `${t.id}:${String(1).padStart(8, '0')}`, { snapshot: snap.snapshot, revision: 1, at })
  }
  await setPrimaryTimeline(t.id)
  return t
}

/* ── conflict recovery (§7.4) ───────────────────────────────────────── */
export async function openConflicts(timelineId?: string) {
  const rows = await all('conflicts')
  return rows
    .map((r) => ({ key: r.key as string, ...r.value }))
    .filter((c) => !c.resolved && (!timelineId || c.timelineId === timelineId))
    .sort((a, b) => b.at.localeCompare(a.at))
}
export async function allConflicts() {
  return (await all('conflicts')).map((r) => ({ key: r.key as string, ...r.value }))
}

/** Another device moved the account's timeline ahead: keep its snapshot as
 *  an archived candidate so the reader chooses (cloud adapter, 📦). */
export async function archiveCloudDivergence(timelineId: string, storyId: string, server: { revision: number; snapshot: any }, localRevision: number) {
  const at = nowIso()
  const key = `${timelineId}:${at}`
  const entry = { timelineId, storyId, at, baseRevision: localRevision, currentRevision: server.revision, candidate: server.snapshot, source: 'cloud', resolved: false }
  await put('conflicts', key, entry)
  return { key, ...entry }
}

export async function resolveConflict(key: string, choice: 'candidate' | 'current') {
  const c = await get('conflicts', key)
  if (!c) return
  if (choice === 'candidate' && c.candidate) {
    const cur = await get('progress', c.timelineId)
    const revision = (cur?.revision ?? 0) + 1
    const now = nowIso()
    await put('progress', c.timelineId, { ...cur, revision, snapshot: c.candidate, updatedAt: now })
    await put('backups', `${c.timelineId}:${String(revision).padStart(8, '0')}`, { snapshot: c.candidate, revision, at: now })
  }
  await put('conflicts', key, { ...c, resolved: true, resolution: choice, resolvedAt: nowIso() })
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
  await put('progress', timelineId, { ...cur, revision, snapshot: b.snapshot, updatedAt: nowIso() })
}

/* ── archive + achievements views ───────────────────────────────────── */
export async function archiveEntries() { return (await all('archiveIndex')).map((r) => r.value) }
export async function achievementRows() { return (await all('achievements')).map((r) => r.value) }

/* ── notes & bookmarks (protocol 1.1 + shell bookmarks) ─────────────── */
export type Note = {
  id: string; storyId: string; timelineId?: string; anchorId: string; label?: string
  kind: 'note' | 'bookmark'; text: string; at: string; source: 'story' | 'shell'
}
const noteListeners = new Set<() => void>()
export const onNotesChange = (fn: () => void) => { noteListeners.add(fn); return () => noteListeners.delete(fn) }
export async function addNote(n: Omit<Note, 'id' | 'at'>) {
  const note: Note = { ...n, text: (n.text ?? '').slice(0, 2000), id: 'note-' + uuid(), at: nowIso() }
  await put('notes', note.id, note)
  noteListeners.forEach((fn) => fn())
  return note
}
export async function allNotes(): Promise<Note[]> {
  return (await all('notes')).map((r) => r.value as Note).sort((a, b) => b.at.localeCompare(a.at))
}
export async function notesFor(storyId: string) { return (await allNotes()).filter((n) => n.storyId === storyId) }
export async function deleteNote(id: string) { await del('notes', id); noteListeners.forEach((fn) => fn()) }

/* ── downloads (offline, §15.7 + ADR-0003) ──────────────────────────── */
export async function saveDownload(releaseId: string, record: any) { await put('downloads', releaseId, record) }
export async function getDownload(releaseId: string) { return get('downloads', releaseId) }
export async function removeDownload(releaseId: string) { await del('downloads', releaseId) }
export async function allDownloads() { return all('downloads') }

/* ── privacy (§19.3) ────────────────────────────────────────────────── */
const EXPORTABLE = ['profile', 'preferences', 'timelines', 'progress', 'operations', 'backups', 'conflicts', 'archiveIndex', 'achievements', 'notes', 'checkpointSnaps', 'sessions', 'kv']
export async function exportEverything() {
  const dump: Record<string, any> = {}
  for (const s of EXPORTABLE) dump[s] = (await all(s)).filter((r) => !(s === 'kv' && r.key === 'registry'))
  return { exportedAt: nowIso(), application: 'storyframe', schema: 2, dump }
}
export async function deleteEverything() { await wipeAll() }

/* ── registry cache for offline boot ────────────────────────────────── */
export async function cacheRegistry(reg: any) { await put('kv', 'registry', { reg, at: Date.now() }) }
export async function cachedRegistry() { return (await get('kv', 'registry'))?.reg ?? null }

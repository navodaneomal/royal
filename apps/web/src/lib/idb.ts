/* A deliberately tiny IndexedDB wrapper — promises, one database,
   explicit stores. No dependency, no magic. */
const DB_NAME = 'storyframe'
const DB_VERSION = 1
export const STORES = [
  'profile',        // key 'me' → { id, createdAt, analyticsConsent }
  'preferences',    // key 'me' → ReaderPreferences
  'timelines',      // key timelineId → { id, storyId, name, isPrimary, createdAt }
  'progress',       // key timelineId → { revision, snapshot, releaseId, updatedAt, completion }
  'operations',     // key operationId → { status, revision, timelineId, at }  (idempotency)
  'backups',        // key `${timelineId}:${revision}` → { snapshot, at }      (last 10)
  'conflicts',      // key `${timelineId}:${at}` → { candidate, baseRevision, at, resolved }
  'downloads',      // key releaseId → { slug, bytes, blob, integrityOk, at }
  'archiveIndex',   // key `${storyId}:${itemId}` → { discoveredAt, checkpointId, timelineId }
  'achievements',   // key `${storyId}:${achId}` → { unlockedAt }
  'telemetry',      // autoincrement → { name, props, at }
  'kv',             // misc: registry cache, session counters
] as const

let dbPromise: Promise<IDBDatabase> | null = null

export function db(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const d = req.result
      for (const name of STORES) {
        if (!d.objectStoreNames.contains(name)) {
          d.createObjectStore(name, name === 'telemetry' ? { autoIncrement: true } : undefined)
        }
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

export async function get<T = any>(store: string, key: IDBValidKey): Promise<T | undefined> {
  const d = await db()
  return new Promise((resolve, reject) => {
    const req = d.transaction(store, 'readonly').objectStore(store).get(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function put(store: string, key: IDBValidKey | undefined, value: any): Promise<void> {
  const d = await db()
  return new Promise((resolve, reject) => {
    const tx = d.transaction(store, 'readwrite')
    if (key === undefined) tx.objectStore(store).put(value)
    else tx.objectStore(store).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function del(store: string, key: IDBValidKey): Promise<void> {
  const d = await db()
  return new Promise((resolve, reject) => {
    const tx = d.transaction(store, 'readwrite')
    tx.objectStore(store).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function all<T = any>(store: string): Promise<{ key: IDBValidKey; value: T }[]> {
  const d = await db()
  return new Promise((resolve, reject) => {
    const out: { key: IDBValidKey; value: T }[] = []
    const req = d.transaction(store, 'readonly').objectStore(store).openCursor()
    req.onsuccess = () => {
      const cur = req.result
      if (!cur) return resolve(out)
      out.push({ key: cur.key, value: cur.value })
      cur.continue()
    }
    req.onerror = () => reject(req.error)
  })
}

/** Run one atomic read-modify-write across stores — the conflict check and
 *  the write happen inside a single IndexedDB transaction. */
export async function atomically<T>(
  stores: string[],
  fn: (tx: IDBTransaction) => Promise<T> | T,
): Promise<T> {
  const d = await db()
  return new Promise<T>((resolve, reject) => {
    const tx = d.transaction(stores, 'readwrite')
    let result: T
    Promise.resolve(fn(tx)).then((r) => { result = r }).catch((e) => { try { tx.abort() } catch {} ; reject(e) })
    tx.oncomplete = () => resolve(result)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('aborted'))
  })
}

export function reqp<T = any>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function wipeAll(): Promise<void> {
  const d = await db()
  await Promise.all(STORES.map((s) => new Promise<void>((resolve, reject) => {
    const tx = d.transaction(s, 'readwrite')
    tx.objectStore(s).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })))
}

/* Offline download manager (§15.7, P0.5, ADR-0003).

   A story becomes "offline ready" only after every byte is verified against
   the release's integrity manifest. Verified single-file packages are kept
   in IndexedDB and later launched from a Blob URL inside an opaque
   sandboxed frame — never rendered in the application DOM. Integrity
   failure means NO offline badge, full stop.

   v2: when production moves to a new release, a downloaded story is
   re-downloaded and re-verified automatically; the old copy is removed only
   after the new one verifies. Removing a download never touches progress. */
import { storyUrl, releaseFor, type CatalogStory } from './catalog'
import { saveDownload, getDownload, removeDownload, allDownloads, getKv } from './store'

async function sha256Hex(buf: ArrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function downloadRelease(story: { slug: string; storyId?: string }, release: { releaseId: string; path: string; version?: string }) {
  const base = release.path.replace(/\/[^/]+$/, '')
  const integrityRes = await fetch(storyUrl(`${base}/integrity.json`), { cache: 'no-store' })
  if (!integrityRes.ok) throw new Error('integrity manifest unavailable')
  const integrity = await integrityRes.json()

  const entryName = release.path.split('/').pop() as string
  const expected = integrity.files?.[entryName]
  if (!expected) throw new Error('integrity manifest does not cover the entrypoint')

  const entryRes = await fetch(storyUrl(release.path), { cache: 'no-store' })
  if (!entryRes.ok) throw new Error('package fetch failed: ' + entryRes.status)
  const bytes = await entryRes.arrayBuffer()
  const hash = 'sha256:' + (await sha256Hex(bytes))
  if (hash !== expected) throw new Error('integrity check FAILED — download discarded')

  await saveDownload(release.releaseId, {
    slug: story.slug, storyId: story.storyId, releaseId: release.releaseId, version: release.version, bytes: bytes.byteLength,
    blob: new Blob([bytes], { type: 'text/html' }), entryName,
    integrityOk: true, verifiedHash: hash, at: new Date().toISOString(),
  })
  return { bytes: bytes.byteLength }
}

export async function offlineReady(releaseId: string) {
  const d = await getDownload(releaseId)
  return !!(d && d.integrityOk)
}

/** Blob URL for the opaque offline frame. Caller revokes it on exit. */
export async function offlineEntryUrl(releaseId: string) {
  const d = await getDownload(releaseId)
  if (!d?.integrityOk) return null
  return URL.createObjectURL(d.blob)
}

export async function deleteDownload(releaseId: string) {
  await removeDownload(releaseId)   // progress is untouched — P0.5
}

export async function downloadsList() {
  return (await allDownloads()).map((r) => ({ releaseId: String(r.key), ...(r.value as any) }))
}

/** Total quota picture from the browser (not every browser reports it). */
export async function storageEstimate() {
  try {
    const e = await navigator.storage?.estimate?.()
    if (!e) return null
    return { usage: e.usage ?? 0, quota: e.quota ?? 0 }
  } catch { return null }
}
export async function requestPersistence() {
  try { return (await navigator.storage?.persist?.()) ?? false } catch { return false }
}
export async function isPersisted() {
  try { return (await navigator.storage?.persisted?.()) ?? false } catch { return false }
}

/**
 * Keep downloads on the current production release: for each downloaded
 * story whose production pointer moved, download + verify the new release,
 * then drop the old copy. Never runs offline; never deletes on failure.
 */
export async function refreshDownloads(stories: CatalogStory[], onEvent?: (msg: string) => void) {
  if (!navigator.onLine) return { updated: 0 }
  if (!(await getKv('autoUpdateDownloads', true))) return { updated: 0 }
  const have = await downloadsList()
  let updated = 0
  for (const d of have) {
    const story = stories.find((s) => s.slug === d.slug)
    const prod = story && releaseFor(story, 'production')
    if (!story || !prod || prod.disabled || prod.releaseId === d.releaseId) continue
    if (have.some((x) => x.releaseId === prod.releaseId)) { await deleteDownload(d.releaseId); continue }
    try {
      await downloadRelease(story, prod)
      await deleteDownload(d.releaseId)
      updated += 1
      onEvent?.(`${story.title}: new edition downloaded and verified`)
    } catch (e: any) {
      onEvent?.(`${story.title}: new edition could not be verified — keeping your current copy`)
    }
  }
  return { updated }
}

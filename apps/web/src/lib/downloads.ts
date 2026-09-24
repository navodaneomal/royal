/* Offline download manager (§15.7, P0.5, ADR-0003).

   A story becomes "offline ready" only after every byte is verified against
   the release's integrity manifest. Verified single-file packages are kept
   in IndexedDB and later launched from a Blob URL inside an opaque
   sandboxed frame — never rendered in the application DOM. Integrity
   failure means NO offline badge, full stop. */
import { storyUrl } from './catalog'
import { saveDownload, getDownload, removeDownload } from './store'

async function sha256Hex(buf: ArrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function downloadRelease(story: { slug: string }, release: { releaseId: string; path: string }) {
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
    slug: story.slug, releaseId: release.releaseId, bytes: bytes.byteLength,
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

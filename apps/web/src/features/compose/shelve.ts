/* Shared by the workshop and the link screen: keep a composed book on this
   device, or publish one or many for everyone through the CI pipeline. */
import { applyPublish, emptyRegistry, sha256Hex, stampComposed, toBase64 } from '@storyframe/publishing'
import { saveDownload, removeDownload } from '../../lib/store'
import { putLocalBook, listLocalBooks } from '../../lib/localBooks'
import { catalog, type CatalogStory } from '../../lib/catalog'
import { adminSession } from '../../lib/admin'
import { gh, watchRun, runOp, type OpUpdate } from '../admin/ops'

export const svgUri = (svg: string) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml' }
export function coverUriOf(composed: any) {
  const name: string = composed.manifest.cover
  const bytes: Uint8Array = composed.source.get(name)
  const ext = name.split('.').pop()!.toLowerCase()
  return ext === 'svg' ? 'data:image/svg+xml;base64,' + toBase64(bytes) : `data:${MIME[ext] ?? 'image/png'};base64,${toBase64(bytes)}`
}

/** Catalog entry (registry shape) for a composed book kept on this device. */
async function asLocalStory(composed: any, now: string) {
  const reg = applyPublish(emptyRegistry(), {
    manifest: composed.build.manifest, releaseId: composed.pack.releaseId, packageHash: composed.pack.packageHash,
    totalBytes: composed.validation.totalBytes, validation: { errors: [], warnings: composed.validation.warnings }, notes: '', channel: 'production', now,
  })
  const story = reg.registry.stories[0] as CatalogStory
  const cover = coverUriOf(composed)
  story.cover = cover
  story.releases = story.releases.map((r) => ({ ...r, cover }))
  return story
}

/** Keep a linked book on this device (no package — just its card). */
export async function keepLinkedHere(composed: any) {
  const now = new Date().toISOString()
  const story = await asLocalStory(composed, now)
  await putLocalBook(story)
  return story
}

/** Keep a Quick Book on this device: the stamped package as a hashed Blob (ADR-0013). */
export async function keepQuickBookHere(composed: any) {
  const now = new Date().toISOString()
  const st = stampComposed(composed, now)!
  const story = await asLocalStory(composed, now)
  const local = await listLocalBooks()
  for (const old of local.find((l) => l.storyId === story.storyId)?.releases ?? []) if (old.releaseId !== composed.pack.releaseId) await removeDownload(old.releaseId)
  await saveDownload(composed.pack.releaseId, {
    slug: story.slug, storyId: story.storyId, releaseId: composed.pack.releaseId, version: composed.manifest.version, bytes: st.entry.byteLength,
    blob: new Blob([st.entry as BlobPart], { type: 'text/html' }), entryName: st.entrypoint,
    integrityOk: true, verifiedHash: 'sha256:' + sha256Hex(st.entry), at: now, local: true,
  })
  await putLocalBook(story)
  return story
}

/**
 * Publish one or many composed books: one commit → the publish workflow →
 * (optionally) straight to production → wait until the library shows them.
 */
export async function publishForEveryone(books: { slug: string; version: string; storyId: string; releaseId: string; title: string; source: Map<string, Uint8Array> }[],
  { goLive, say, onRun, refreshCatalog }: { goLive: boolean; say: (m: string) => void; onRun: (u: OpUpdate) => void; refreshCatalog: () => Promise<void> | void }) {
  const client = gh()
  if (!client) throw new Error('connect GitHub first')
  const session = adminSession()
  const r = books.length === 1
    ? await client.publishStory({ branch: session.branch, slug: books[0].slug, version: books[0].version, files: books[0].source, onProgress: say })
    : await client.publishMany({ branch: session.branch, books: books.map((b) => ({ slug: b.slug, files: b.source })), message: `publish: ${books.length} books (${books.map((b) => b.slug).join(', ').slice(0, 180)})`, onProgress: say })
  say(`✓ Committed ${books.length === 1 ? 'the book' : books.length + ' books'} (${r.commitSha.slice(0, 7)}).`)
  const first = await watchRun(client, null, () => client.findRunForCommit(r.commitSha), onRun)
  if (first?.conclusion !== 'success') { say(`✗ The publish workflow finished: ${first?.conclusion ?? 'unknown'} — open the run for the log.`); return false }
  say('✓ Built, checked, and published to beta.')
  if (goLive) {
    say('Putting it on the shelf for every reader…')
    const last: { u: OpUpdate | null } = { u: null }
    await runOp('publish', { slug: books.map((b) => b.slug).join(','), channel: 'production' }, (u) => { onRun(u); last.u = u })
    if (last.u?.phase === 'error' || (last.u?.conclusion && last.u.conclusion !== 'success')) { say(`✗ Going live failed: ${last.u?.conclusion ?? last.u?.message}`); return false }
  }
  say('Waiting for the site to update (GitHub Pages can take a minute)…')
  const channel = goLive ? 'production' : 'beta'
  for (let i = 0; i < 72; i++) {
    const c = await catalog(true)
    const live = books.filter((b) => c.stories.find((s) => s.storyId === b.storyId && !s.local)?.channels?.[channel]?.releaseId === b.releaseId)
    if (live.length === books.length) { await refreshCatalog(); say(goLive ? '✓ Live for every reader.' : '✓ Live on the beta channel — promote it from Release management.'); return true }
    await new Promise((res) => setTimeout(res, 5000))
  }
  say('The workflows succeeded, but the site has not shown it yet — it can take a few minutes.')
  return true
}

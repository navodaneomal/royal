/* Books on this device — no hosting, no account, no network.

   A book a reader adds (#/add) is compiled in the browser by the same
   builder and release gate CI uses, then kept in two places:
     kv "localBooks"      the catalog entry (same shape as registry.json)
     downloads store      the single-file package as a Blob, with the hash
                          we computed when we built it
   It plays exactly like a verified offline download: a Blob URL in an
   OPAQUE sandbox with the story CSP inside the bytes (ADR-0003). Removing
   a book never touches reading progress. Saving lives in the composer
   chunk (it needs @storyframe/publishing); listing stays tiny. */
import { getKv, setKv, removeDownload } from './store'
import type { CatalogStory } from './catalog'

const KEY = 'localBooks'

export async function listLocalBooks(): Promise<CatalogStory[]> {
  const list = await getKv<CatalogStory[]>(KEY, []).catch(() => [])
  return Array.isArray(list) ? list.map((s) => ({ ...s, local: true })) : []
}

export async function putLocalBook(story: CatalogStory) {
  const list = (await listLocalBooks()).filter((s) => s.storyId !== story.storyId)
  await setKv(KEY, [...list, { ...story, local: true }])
}

export async function removeLocalBook(storyId: string) {
  const list = await listLocalBooks()
  const gone = list.find((s) => s.storyId === storyId)
  await setKv(KEY, list.filter((s) => s.storyId !== storyId))
  for (const r of gone?.releases ?? []) await removeDownload(r.releaseId)   // progress is untouched
}

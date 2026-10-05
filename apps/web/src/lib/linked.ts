/* Linked books (ADR-0014) on the reader's side.

   A linked book lives on another site, so Storyframe cannot see the reader's
   place inside it. What it can honestly keep — on this device only — is when
   the reader last opened it and whether they marked it finished. Nothing is
   sent to the other site: links open with rel="noopener noreferrer", and an
   embedded one runs in a sandboxed frame with no bridge and no reader data. */
import { getKv, setKv } from './store'
import { releaseFor, type CatalogStory } from './catalog'

export type LinkInfo = { url: string; open: 'tab' | 'embed'; kind: string; author?: string }
export type Mark = { openedAt?: string; finishedAt?: string | null }

const KEY = 'linkedMarks'
let cache: Record<string, Mark> | null = null
const listeners = new Set<(m: Record<string, Mark>) => void>()

export function linkFor(story: CatalogStory | null | undefined, channel = 'production'): LinkInfo | null {
  if (!story) return null
  const rel = releaseFor(story, channel) ?? (story.releases?.[0] as any)
  return (rel as any)?.link ?? rel?.meta?.link ?? null
}
export const hostOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url } }
export const KIND_ICON: Record<string, string> = { web: '↗', pdf: 'PDF', epub: 'EPUB', flipbook: 'Flipbook', audio: 'Audio', video: 'Video', other: '↗' }

export async function marks(): Promise<Record<string, Mark>> {
  if (!cache) cache = await getKv<Record<string, Mark>>(KEY, {}).catch(() => ({})) ?? {}
  return cache!
}
export const onMarks = (fn: (m: Record<string, Mark>) => void) => { listeners.add(fn); return () => listeners.delete(fn) }
async function save(next: Record<string, Mark>) { cache = next; await setKv(KEY, next); listeners.forEach((fn) => fn(next)) }

export async function markOpened(storyId: string) {
  const m = await marks()
  await save({ ...m, [storyId]: { ...m[storyId], openedAt: new Date().toISOString() } })
}
export async function setFinished(storyId: string, finished: boolean) {
  const m = await marks()
  await save({ ...m, [storyId]: { ...m[storyId], openedAt: m[storyId]?.openedAt ?? new Date().toISOString(), finishedAt: finished ? new Date().toISOString() : null } })
}
export const statusFromMark = (m?: Mark) => (!m?.openedAt ? 'unread' : m.finishedAt ? 'finished' : 'inProgress')

/** Where tapping the book goes: the other site in a new tab, or the in-app reader for embeddable links. */
export function openTarget(story: CatalogStory, link: LinkInfo) {
  const embed = link.open === 'embed' && !story.local
  return embed ? { href: `#/play/${story.slug}`, newTab: false } : { href: link.url, newTab: true }
}

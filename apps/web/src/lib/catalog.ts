/* Catalog access: the application plane's read-only view of the content
   plane (§11). The registry is fetched fresh when online and cached in
   IndexedDB so the shelf still opens on a plane. */
import { cacheRegistry, cachedRegistry } from './store'

const configured = (import.meta as any).env?.VITE_STORY_ORIGIN as string | undefined
export const STORY_BASE = (configured && configured.replace(/\/$/, '')) || '/stories-host'

export const isCrossOrigin = (() => {
  try { return STORY_BASE.startsWith('http') && new URL(STORY_BASE).origin !== location.origin }
  catch { return false }
})()

export const storyUrl = (path: string) => `${STORY_BASE}/${path.replace(/^\//, '')}`

export type CatalogStory = {
  storyId: string; slug: string; title: string; tagline: string; cover: string
  channels: Record<string, { releaseId: string; disabled: boolean }>
  releases: { releaseId: string; version: string; path: string; publishedAt: string; status: string; packageHash: string }[]
  meta: any
}

let memo: { at: number; stories: CatalogStory[] } | null = null

export async function catalog(force = false): Promise<{ stories: CatalogStory[]; offline: boolean }> {
  if (memo && !force && Date.now() - memo.at < 30_000) return { stories: memo.stories, offline: false }
  try {
    const res = await fetch(storyUrl('registry.json'), { cache: 'no-store' })
    if (!res.ok) throw new Error('registry ' + res.status)
    const reg = await res.json()
    memo = { at: Date.now(), stories: reg.stories ?? [] }
    cacheRegistry(reg).catch(() => {})
    return { stories: memo.stories, offline: false }
  } catch {
    const reg = await cachedRegistry()
    return { stories: reg?.stories ?? [], offline: true }
  }
}

export function productionRelease(story: CatalogStory) {
  const ch = story.channels?.production
  if (!ch) return null
  const rel = story.releases.find((r) => r.releaseId === ch.releaseId) ?? null
  return rel ? { ...rel, disabled: !!ch.disabled } : null
}

export function checkpointLabel(story: CatalogStory, checkpointId: string) {
  const cp = (story.meta?.checkpoints ?? []).find((c: any) => c.id === checkpointId)
  return cp?.label ?? checkpointId
}

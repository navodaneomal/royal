/* Catalog access: the application plane's read-only view of the content
   plane (§11). The registry is fetched fresh when online and cached in
   IndexedDB so the shelf still opens on a plane.

   v2: the story origin comes from the runtime config (/config.json), and
   every release carries its own metadata — the IDs a release validates
   against are that release's, never whatever was published last. */
import { cacheRegistry, cachedRegistry } from './store'
import { config } from './config'

export const storyBase = () => config().storyOrigin.replace(/\/$/, '')
/** @deprecated v1 name — the base can change after boot, so call storyBase() */
export const STORY_BASE_DEFAULT = '/stories-host'

export const isCrossOrigin = () => {
  try { return storyBase().startsWith('http') && new URL(storyBase()).origin !== location.origin }
  catch { return false }
}
export const storyUrl = (path: string) => `${storyBase()}/${String(path).replace(/^\//, '')}`

export type Release = {
  releaseId: string; version: string; path: string; publishedAt: string; status: string; packageHash: string
  cover?: string; manifestPath?: string; title?: string; tagline?: string; synopsis?: string; accent?: string | null
  notes?: string; validation?: { errors?: string[]; warnings?: string[] }; meta?: any
}
export type CatalogStory = {
  storyId: string; slug: string; title: string; tagline: string; synopsis?: string; accent?: string | null; cover: string
  channels: Record<string, { releaseId: string; disabled: boolean }>
  releases: Release[]
  meta: any
}
export type ChannelRelease = Release & { meta: any; disabled: boolean; channel: string }

let memo: { at: number; stories: CatalogStory[]; generatedAt: string | null } | null = null
const listeners = new Set<(stories: CatalogStory[]) => void>()
export const onCatalog = (fn: (s: CatalogStory[]) => void) => { listeners.add(fn); return () => listeners.delete(fn) }

export async function catalog(force = false): Promise<{ stories: CatalogStory[]; offline: boolean; error?: string }> {
  if (memo && !force && Date.now() - memo.at < 30_000) return { stories: memo.stories, offline: false }
  try {
    const res = await fetch(storyUrl('registry.json'), { cache: 'no-store' })
    if (!res.ok) throw new Error('registry ' + res.status)
    const reg = await res.json()
    memo = { at: Date.now(), stories: reg.stories ?? [], generatedAt: reg.generatedAt ?? null }
    cacheRegistry(reg).catch(() => {})
    listeners.forEach((fn) => fn(memo!.stories))
    return { stories: memo.stories, offline: false }
  } catch (e: any) {
    const reg = await cachedRegistry()
    return { stories: reg?.stories ?? [], offline: true, error: String(e?.message ?? e) }
  }
}

/** The release a channel points at, with that release's own metadata. */
export function releaseFor(story: CatalogStory, channel = 'production'): ChannelRelease | null {
  const ch = story.channels?.[channel]
  if (!ch) return null
  const rel = story.releases.find((r) => r.releaseId === ch.releaseId)
  return rel ? { ...rel, meta: rel.meta ?? story.meta, disabled: !!ch.disabled, channel } : null
}
export const productionRelease = (story: CatalogStory) => releaseFor(story, 'production')

/** The reducer's view of a release: exactly the IDs that release declared. */
export function manifestFor(story: CatalogStory, release: ChannelRelease) {
  const m = release.meta ?? {}
  return {
    storyId: story.storyId, slug: story.slug, version: release.version,
    protocolVersion: m.protocolVersion ?? '1.0', stateSchemaVersion: m.stateSchemaVersion ?? 1,
    title: release.title ?? story.title, entrypoint: release.path.split('/').pop() || 'index.html',
    languages: m.languages ?? ['en'], defaultLanguage: m.languages?.[0] ?? 'en',
    capabilities: m.capabilities ?? [],
    content: m.content, accessibility: m.accessibility,
    offline: { eligible: !!m.offlineEligible, required: [], optional: [], maxBytes: m.maxBytes ?? 50 * 1024 * 1024 },
    checkpoints: m.checkpoints ?? [], items: m.items ?? [], achievements: m.achievements ?? [],
    choices: m.choices ?? [], endings: m.endings ?? [], migrations: m.migrations ?? [],
  }
}

/** Full storyframe.json of a release (Admin diff/compat views). */
export async function fetchReleaseManifest(story: CatalogStory, releaseId: string) {
  const rel = story.releases.find((r) => r.releaseId === releaseId)
  const path = rel?.manifestPath ?? `packages/${story.slug}/${releaseId}/storyframe.json`
  const res = await fetch(storyUrl(path), { cache: 'force-cache' })
  if (!res.ok) throw new Error(`manifest for ${releaseId}: HTTP ${res.status}`)
  return res.json()
}

export function checkpointLabel(story: CatalogStory, checkpointId: string, release?: ChannelRelease | null) {
  const list = (release?.meta ?? story.meta)?.checkpoints ?? []
  const cp = list.find((c: any) => c.id === checkpointId)
  return cp?.label ?? checkpointId
}

/** Reader-facing position: "Part III — … · 3 of 11" (never a percentage). */
export function position(story: CatalogStory, checkpointId: string, release?: ChannelRelease | null) {
  const list = [...((release?.meta ?? story.meta)?.checkpoints ?? [])].sort((a: any, b: any) => a.order - b.order)
  const i = list.findIndex((c: any) => c.id === checkpointId)
  return { label: i >= 0 ? list[i].label : checkpointId, index: i, total: list.length }
}

export const coverUrl = (story: CatalogStory, release?: Release | null) => storyUrl(release?.cover ?? story.cover)

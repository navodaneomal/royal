/* Where the edge functions learn what a release declares (ADR-0005).
 *
 * v1 looked releases up in `story_versions` — a table nothing populated,
 * keyed by UUID while release ids are `r<sha256[:12]>` — so every commit
 * would have failed with release_not_approved. v2 reads the SAME public
 * content plane the app reads: registry.json says which releases exist and
 * whether a channel is disabled; the release's own storyframe.json is the
 * manifest. Set STORIES_ORIGIN (e.g. https://storyframe-stories.pages.dev).
 */
import { ManifestSchema } from './protocol/schemas.js'

type Cached = { at: number; value: any }
const cache = new Map<string, Cached>()
const TTL = 60_000

async function getJson(url: string) {
  const hit = cache.get(url)
  if (hit && Date.now() - hit.at < TTL) return hit.value
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  const value = await res.json()
  cache.set(url, { at: Date.now(), value })
  return value
}

/** @returns {{ manifest, story, release }} or throws with a reason code */
export async function loadReleaseManifest(storyId: string, releaseId: string | null) {
  const origin = (Deno.env.get('STORIES_ORIGIN') ?? '').replace(/\/$/, '')
  if (!origin) throw Object.assign(new Error('STORIES_ORIGIN not set'), { code: 'misconfigured' })
  const registry = await getJson(`${origin}/registry.json`)
  const story = (registry.stories ?? []).find((s: any) => s.storyId === storyId)
  if (!story) throw Object.assign(new Error('unknown story'), { code: 'unknown_story' })
  // the release the reader is on, else whatever production serves
  const rid = releaseId && story.releases.some((r: any) => r.releaseId === releaseId) ? releaseId : story.channels?.production?.releaseId
  const release = story.releases.find((r: any) => r.releaseId === rid)
  if (!release || release.status !== 'approved') throw Object.assign(new Error('release not approved'), { code: 'release_not_approved' })
  const raw = await getJson(`${origin}/${release.manifestPath ?? `packages/${story.slug}/${rid}/storyframe.json`}`)
  return { manifest: ManifestSchema.parse(raw), story, release }
}

/** reader_timelines.story_id references stories(id): make sure the row exists. */
export async function ensureStoryRow(admin: any, story: any) {
  await admin.from('stories').upsert({ id: story.storyId, slug: story.slug, title: story.title, tagline: story.tagline ?? null, visibility: 'public' }, { onConflict: 'id' })
}

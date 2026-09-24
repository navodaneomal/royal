/* Story detail (§9.3): more than genre — session shape, interaction modes,
   declared alternatives, content notes behind intentional reveal, size and
   offline state, and an honest release line for returning readers. */
import React, { useEffect, useState } from 'react'
import { catalog, productionRelease, storyUrl } from '../lib/catalog'
import { primaryTimeline, getProgress } from '../lib/store'
import { downloadRelease, offlineReady, deleteDownload } from '../lib/downloads'
import { track } from '../lib/telemetry'
import { useApp } from '../main'

export function StoryDetail({ slug }: { slug: string }) {
  const { toast } = useApp()
  const [story, setStory] = useState<any>(null)
  const [release, setRelease] = useState<any>(null)
  const [progress, setProgress] = useState<any>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)

  async function load() {
    const { stories } = await catalog()
    const s = stories.find((x) => x.slug === slug)
    setStory(s ?? null)
    if (s) {
      const rel = productionRelease(s)
      setRelease(rel)
      const t = await primaryTimeline(s.storyId)
      setProgress(await getProgress(t.id))
      if (rel) setReady(await offlineReady(rel.releaseId))
    }
  }
  useEffect(() => { load() }, [slug])

  if (!story) return <main className="page"><h1>Story not found</h1><p className="lede">It may be unlisted, retired, or the catalog is unreachable.</p></main>

  const m = story.meta ?? {}
  const acc = m.accessibility ?? {}
  const est = m.estimatedMinutes ?? m.content?.estimatedMinutes
  const sizeKb = Math.max(1, Math.round((m.sizeBytes ?? 0) / 1024))
  const disabled = release?.disabled

  async function onDownload() {
    setBusy(true)
    try {
      const r = await downloadRelease(story, release)
      track('offline_download_completed', { bytes_bucket: r.bytes > 1e6 ? '>1MB' : '<1MB' })
      toast('Downloaded and integrity-verified — offline ready')
      setReady(true)
    } catch (e: any) {
      toast('Download failed: ' + e.message)
    } finally { setBusy(false) }
  }

  return (
    <main className="page">
      <div className="detail">
        <div className="cover"><img src={storyUrl(story.cover)} alt={`Cover of ${story.title}`} /></div>
        <div>
          <h1>{story.title}</h1>
          <p className="lede">{story.tagline}</p>

          {disabled && (
            <p className="callout" role="status">
              The operator has paused new launches of this story. Your progress is safe;
              reading will resume when a healthy release is restored.
            </p>
          )}

          <div className="btn-row">
            {!disabled && release && (
              <a className="btn" href={`#/play/${story.slug}`}
                onClick={() => track('story_launch_requested', { story_id: story.storyId, release_id: release.releaseId, online: navigator.onLine })}>
                {progress ? 'Continue' : 'Start reading'}
              </a>
            )}
            {release && m.offlineEligible && !ready && (
              <button className="btn secondary" onClick={onDownload} disabled={busy}>
                {busy ? 'Verifying…' : `Download for offline (~${sizeKb} KB)`}
              </button>
            )}
            {release && ready && (
              <>
                <a className="btn secondary" href={`#/play/${story.slug}/offline`}>Play offline copy</a>
                <button className="btn danger" onClick={async () => { await deleteDownload(release.releaseId); setReady(false); toast('Download removed. Progress kept.') }}>
                  Remove download
                </button>
              </>
            )}
          </div>

          <ul className="facts">
            {est && <li><b>Session shape</b><span>first session ≈ {est.firstSession} min · full story {est.total?.[0]}–{est.total?.[1]} min</span></li>}
            <li><b>Interaction</b><span>choices, reading{story.slug === 'neon-horizon' ? ', typed commands, one deduction puzzle' : ', exploration, hidden discoveries'}</span></li>
            <li><b>Alternatives</b><span>
              {acc.keyboard && 'keyboard '} {acc.reducedMotion && '· reduced motion '}
              {acc.untimedMode && '· untimed '} {acc.nonAudioAlternative && '· no audio required'}
            </span></li>
            <li><b>Screen reader</b><span>{acc.screenReader ? 'supported' : 'not declared'}</span></li>
            <li><b>Storage</b><span>{sizeKb} KB{m.offlineEligible ? ' · offline eligible' : ' · online only'}</span></li>
            <li><b>Release</b><span><code className="mono">{release?.releaseId ?? 'none'}</code> · v{release?.version} · {release ? new Date(release.publishedAt).toLocaleDateString() : ''}</span></li>
            {progress && <li><b>Your progress</b><span>revision {progress.revision} · {progress.completion === 'completed' ? 'completed' : 'in progress'}</span></li>}
          </ul>

          <details className="notes">
            <summary>Content notes (reveal intentionally)</summary>
            <p style={{ marginBottom: 0 }}>
              Rated {m.content?.rating ?? 'unrated'}.
              {(m.content?.warnings ?? []).length ? ' Themes: ' + m.content.warnings.join(', ') + '.' : ' No notes declared.'}
            </p>
          </details>
        </div>
      </div>
    </main>
  )
}

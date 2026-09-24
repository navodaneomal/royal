/* Story detail (§9.3): synopsis, the reader's way through in story
   language (reached checkpoints named, the rest sealed — no spoilers, no
   percentages), content notes behind an intentional reveal, accessibility
   badges, size and offline state, release notes, and an honest line when a
   new edition has arrived since the reader last played. */
import React, { useEffect, useState } from 'react'
import { useApp } from '../context'
import { releaseFor, coverUrl, storyUrl, type CatalogStory } from '../lib/catalog'
import { primaryTimeline, getProgress, notesFor, type Note } from '../lib/store'
import { downloadRelease, offlineReady, deleteDownload } from '../lib/downloads'
import { track } from '../lib/telemetry'
import { t, fmtDate, fmtBytes } from '../lib/i18n'
import { Cover } from '../components/Cover'

const ACCESS: [string, string][] = [['keyboard', 'access.keyboard'], ['screenReader', 'access.screenReader'], ['reducedMotion', 'access.reducedMotion'], ['untimedMode', 'access.untimed'], ['nonAudioAlternative', 'access.noAudio'], ['captions', 'access.captions']]

export function StoryDetail({ slug }: { slug: string }) {
  const { toast, stories } = useApp()
  const story = stories?.find((x) => x.slug === slug) ?? null
  const release = story ? releaseFor(story) : null
  const [progress, setProgress] = useState<any>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notes, setNotes] = useState<Note[]>([])

  useEffect(() => {
    if (!story) return
    ;(async () => {
      const tl = await primaryTimeline(story.storyId)
      setProgress(await getProgress(tl.id))
      if (release) setReady(await offlineReady(release.releaseId))
      setNotes(await notesFor(story.storyId))
    })()
  }, [story?.storyId, release?.releaseId])

  if (stories === null) return <main className="page"><div className="skeleton" style={{ height: '20rem', borderRadius: 16 }} aria-hidden="true" /></main>
  if (!story) return <main className="page"><h1>{t('detail.notFound')}</h1><p className="lede">{t('detail.notFoundBody')}</p></main>

  const m = release?.meta ?? story.meta ?? {}
  const acc = m.accessibility ?? {}
  const est = m.estimatedMinutes ?? m.content?.estimatedMinutes
  const size = m.sizeBytes ?? 0
  const disabled = release?.disabled
  const checkpoints = [...(m.checkpoints ?? [])].sort((a: any, b: any) => a.order - b.order)
  const snap = progress?.snapshot
  const visited = new Set<string>(snap?.visitedMoments ?? [])
  const here = snap?.checkpointId
  const hereOrder = snap?.checkpointOrder ?? -1
  const reachedCount = checkpoints.filter((c: any) => visited.has(c.id) || c.order <= hereOrder).length
  const newEdition = progress?.releaseId && release && progress.releaseId !== release.releaseId
  const needsMigration = newEdition && snap && snap.stateSchemaVersion !== (m.stateSchemaVersion ?? 1)
  const title = release?.title ?? story.title
  const synopsis = release?.synopsis ?? story.synopsis
  const shareUrl = storyUrl(`share/${story.slug}.html`)

  async function onDownload() {
    if (!release) return
    setBusy(true)
    try {
      const r = await downloadRelease(story!, release)
      track('offline_download_completed', { bytes_bucket: r.bytes > 1e6 ? '>1MB' : '<1MB' })
      toast(t('detail.downloaded'))
      setReady(true)
    } catch (e: any) {
      toast(t('detail.downloadFailed', { error: e.message }))
    } finally { setBusy(false) }
  }
  async function onShare() {
    const url = /^https?:/.test(shareUrl) ? shareUrl : new URL(shareUrl, location.href).href
    try {
      if (navigator.share) await navigator.share({ title, text: story!.tagline, url })
      else { await navigator.clipboard.writeText(url); toast(t('detail.shareCopied')) }
    } catch { /* reader cancelled */ }
  }

  return (
    <main className="page">
      <div className="detail">
        <div className="cover"><Cover src={coverUrl(story, release)} title={title} alt={`Cover of ${title}`} /></div>
        <div>
          <h1>{title}</h1>
          <p className="lede" style={{ marginBottom: '1rem' }}>{release?.tagline ?? story.tagline}</p>

          {disabled && <p className="callout bad" role="status">{t('detail.paused')}</p>}
          {newEdition && !disabled && (
            <p className="callout info" role="status">{needsMigration ? t('detail.newEditionMigrated', { version: release!.version }) : t('detail.newEdition', { version: release!.version })}</p>
          )}

          <div className="btn-row">
            {!disabled && release && (
              <a className="btn" href={`#/play/${story.slug}`}
                onClick={() => track('story_launch_requested', { story_id: story.storyId, release_id: release.releaseId, online: navigator.onLine })}>
                {progress ? t('detail.continue') : t('detail.start')}
              </a>
            )}
            {release && m.offlineEligible && !ready && (
              <button className="btn secondary" onClick={onDownload} disabled={busy}>
                {busy ? t('detail.verifying') : t('detail.download', { size: fmtBytes(size) })}
              </button>
            )}
            {release && ready && (
              <>
                <a className="btn secondary" href={`#/play/${story.slug}/offline`}>{t('detail.playOffline')}</a>
                <button className="btn danger" onClick={async () => { await deleteDownload(release.releaseId); setReady(false); toast(t('detail.removed')) }}>
                  {t('detail.removeDownload')}
                </button>
              </>
            )}
            <button className="btn ghost" onClick={onShare}>{t('detail.share')}</button>
          </div>

          {synopsis && <p className="synopsis">{synopsis}</p>}

          <div className="a11y-badges" aria-label={t('detail.access')}>
            {ACCESS.filter(([k]) => acc[k]).map(([k, label]) => <span key={k} className="badge good">✓ {t(label)}</span>)}
          </div>

          <h2>{t('detail.map')}</h2>
          {snap ? (
            <>
              <p className="small muted">{t('detail.mapCount', { reached: reachedCount, total: checkpoints.length })}</p>
              <ol className="cp-map">
                {checkpoints.map((c: any) => {
                  const reached = visited.has(c.id) || c.order <= hereOrder
                  const isHere = c.id === here
                  return (
                    <li key={c.id} className={isHere ? 'here' : reached ? 'reached' : 'sealed'}>
                      <span className="dot" aria-hidden="true" />
                      {isHere ? <span><strong>{c.label}</strong> <span className="small muted">— {t('detail.mapHere')}</span></span>
                        : reached ? <span>{c.label}</span> : <span aria-label={t('detail.mapSealed')}>· · ·</span>}
                    </li>
                  )
                })}
              </ol>
            </>
          ) : <p className="small muted">{t('detail.mapStart', { total: checkpoints.length })}</p>}

          {release?.notes && (
            <>
              <h2>{t('detail.releaseNotes')}</h2>
              <p className="release-notes">{release.notes}</p>
            </>
          )}

          <h2>{t('detail.facts')}</h2>
          <ul className="facts">
            {est && <li><b>{t('detail.session')}</b><span>{t('detail.sessionValue', { first: est.firstSession, min: est.total?.[0], max: est.total?.[1] })}</span></li>}
            <li><b>{t('detail.storage')}</b><span>{m.offlineEligible ? t('detail.storageOffline', { size: fmtBytes(size) }) : t('detail.storageOnline', { size: fmtBytes(size) })}</span></li>
            {release && <li><b>{t('detail.edition')}</b><span>{t('detail.editionValue', { version: release.version, date: fmtDate(release.publishedAt) })} · <code className="mono">{release.releaseId}</code></span></li>}
            <li><b>{t('detail.languages')}</b><span>{(m.languages ?? ['en']).join(', ')}</span></li>
            {progress && <li><b>Revision</b><span>revision {progress.revision} · {progress.completion === 'completed' ? t('status.finished') : t('status.inProgress')}</span></li>}
          </ul>

          <details className="notes">
            <summary>{t('detail.warnings')}</summary>
            <p style={{ marginBottom: 0 }}>
              {t('detail.rated', { rating: t('rating.' + (m.content?.rating ?? 'everyone')) })}{' '}
              {(m.content?.warnings ?? []).length ? t('detail.themes', { list: m.content.warnings.join(', ') }) : t('detail.noNotes')}
            </p>
          </details>

          {notes.length > 0 && (
            <>
              <h2>{t('detail.yourNotes')}</h2>
              <ul className="list">
                {notes.map((n) => <li key={n.id}><span className="grow"><span className="small muted">{n.kind === 'bookmark' ? t('notes.bookmark') : t('notes.note')} · {n.label ?? n.anchorId} · {fmtDate(n.at)}</span>{n.text && <><br />{n.text}</>}</span></li>)}
              </ul>
            </>
          )}
        </div>
      </div>
    </main>
  )
}

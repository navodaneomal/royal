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
import { removeLocalBook } from '../lib/localBooks'
import { linkFor, marks as loadMarks, onMarks, markOpened, setFinished, hostOf, openTarget, type Mark } from '../lib/linked'
const ShareDialog = React.lazy(() => import('../components/QrCode').then((m) => ({ default: m.ShareDialog })))
import { Segments } from './Shelf'
import { PlayIcon, DownloadIcon, QrIcon } from '../components/Icons'

const ACCESS: [string, string][] = [['keyboard', 'access.keyboard'], ['screenReader', 'access.screenReader'], ['reducedMotion', 'access.reducedMotion'], ['untimedMode', 'access.untimed'], ['nonAudioAlternative', 'access.noAudio'], ['captions', 'access.captions']]

export function StoryDetail({ slug }: { slug: string }) {
  const { toast, stories, refreshCatalog } = useApp()
  const story = stories?.find((x) => x.slug === slug) ?? null
  const release = story ? releaseFor(story) : null
  const [progress, setProgress] = useState<any>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notes, setNotes] = useState<Note[]>([])
  const [sharing, setSharing] = useState(false)
  const [mark, setMark] = useState<Mark | undefined>(undefined)
  useEffect(() => {
    if (!story) return
    loadMarks().then((m) => setMark(m[story.storyId]))
    return onMarks((m) => setMark(m[story.storyId])) as any
  }, [story?.storyId])

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
  // the share card when the library publishes one; the app's own deep link otherwise
  const shareTarget = story.local ? null : (/^https?:/.test(shareUrl) ? shareUrl : new URL(shareUrl, location.href).href)
  const deepLink = new URL(`#/story/${story.slug}`, location.href).href
  const herePos = snap ? Math.max(0, checkpoints.findIndex((c: any) => c.id === here)) : 0
  const link = linkFor(story)
  const linkTarget = link ? openTarget(story, link) : null
  const linkHost = link ? hostOf(link.url) : ''

  return (
    <main className="page">
      <section className="detail-hero" style={{ ['--hero-cover' as any]: `url("${coverUrl(story, release)}")` }}>
        <div className="detail">
          <div className="cover"><Cover src={coverUrl(story, release)} title={title} alt={`Cover of ${title}`} /></div>
          <div style={{ minWidth: 0 }}>
            {story.local && <p className="eyebrow">{t('detail.localKicker')}</p>}
            <h1>{title}</h1>
            <p className="lede" style={{ marginBottom: '1rem' }}>{release?.tagline ?? story.tagline}</p>

            {disabled && <p className="callout bad" role="status">{t('detail.paused')}</p>}
            {newEdition && !disabled && (
              <p className="callout info" role="status">{needsMigration ? t('detail.newEditionMigrated', { version: release!.version }) : t('detail.newEdition', { version: release!.version })}</p>
            )}
            {snap && checkpoints.length > 1 && (
              <div style={{ maxWidth: '24rem', margin: '0 0 0.4rem' }}>
                <Segments index={herePos} total={checkpoints.length} done={progress?.completion === 'completed'} label={t('detail.mapCount', { reached: reachedCount, total: checkpoints.length })} />
              </div>
            )}

            <div className="btn-row">
              {link && !disabled && (
                <>
                  {linkTarget!.newTab ? (
                    <a className="btn big" href={link.url} target="_blank" rel="noopener noreferrer" onClick={() => markOpened(story.storyId)}>
                      <PlayIcon /> {t('linked.open')} ↗<span className="sr"> {t('linked.newTab')}</span>
                    </a>
                  ) : (
                    <>
                      <a className="btn big" href={`#/play/${story.slug}`} onClick={() => markOpened(story.storyId)}><PlayIcon /> {t('linked.readHere')}</a>
                      <a className="btn secondary" href={link.url} target="_blank" rel="noopener noreferrer" onClick={() => markOpened(story.storyId)}>{t('linked.openOn', { host: linkHost })} ↗<span className="sr"> {t('linked.newTab')}</span></a>
                    </>
                  )}
                  <button className="btn secondary" aria-pressed={!!mark?.finishedAt} onClick={() => setFinished(story.storyId, !mark?.finishedAt)}>
                    {mark?.finishedAt ? t('linked.markUnfinished') : t('linked.markFinished')}
                  </button>
                </>
              )}
              {!link && !disabled && release && (
                <a className="btn big" href={`#/play/${story.slug}`}
                  onClick={() => track('story_launch_requested', { story_id: story.storyId, release_id: release.releaseId, online: navigator.onLine })}>
                  <PlayIcon /> {progress ? t('detail.continue') : t('detail.start')}
                </a>
              )}
              {release && !link && !story.local && m.offlineEligible && !ready && (
                <button className="btn secondary" onClick={onDownload} disabled={busy}>
                  <DownloadIcon /> {busy ? t('detail.verifying') : t('detail.download', { size: fmtBytes(size) })}
                </button>
              )}
              {release && !link && !story.local && ready && (
                <>
                  <a className="btn secondary" href={`#/play/${story.slug}/offline`}>{t('detail.playOffline')}</a>
                  <button className="btn danger" onClick={async () => { await deleteDownload(release.releaseId); setReady(false); toast(t('detail.removed')) }}>
                    {t('detail.removeDownload')}
                  </button>
                </>
              )}
              {story.local && (
                <button className="btn danger" onClick={async () => {
                  if (!confirm(t('detail.localRemoveConfirm', { title }))) return
                  await removeLocalBook(story.storyId); await refreshCatalog(); toast(t('detail.localRemoved')); location.hash = '#/'
                }}>{t('detail.localRemove')}</button>
              )}
              {!story.local && <button className="btn ghost" onClick={() => setSharing(true)}><QrIcon /> {t('detail.share')}</button>}
            </div>

            <div className="a11y-badges" aria-label={t('detail.access')}>
              {ACCESS.filter(([k]) => acc[k]).map(([k, label]) => <span key={k} className="badge good">✓ {t(label)}</span>)}
            </div>
          </div>
        </div>
      </section>

      <div className="detail-body">
        <div style={{ minWidth: 0 }}>
          {synopsis && <p className="synopsis">{synopsis}</p>}

          {link && (
            <p className="callout info linked-note">
              <span>{t('linked.note', { host: linkHost })}{mark?.openedAt ? ' ' + t('linked.lastOpened', { date: fmtDate(mark.openedAt) }) : ''}</span>
            </p>
          )}

          {!link && <h2>{t('detail.map')}</h2>}
          {link ? null : snap ? (
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

          {notes.length > 0 && (
            <>
              <h2>{t('detail.yourNotes')}</h2>
              <ul className="list">
                {notes.map((n) => <li key={n.id}><span className="grow"><span className="small muted">{n.kind === 'bookmark' ? t('notes.bookmark') : t('notes.note')} · {n.label ?? n.anchorId} · {fmtDate(n.at)}</span>{n.text && <><br />{n.text}</>}</span></li>)}
              </ul>
            </>
          )}
        </div>

        <aside aria-label={t('detail.facts')}>
          <h2>{t('detail.facts')}</h2>
          <ul className="facts">
            {est && <li><b>{t('detail.session')}</b><span>{t('detail.sessionValue', { first: est.firstSession, min: est.total?.[0], max: est.total?.[1] })}</span></li>}
            {link && <li><b>{t('linked.hostedOn')}</b><span>{linkHost} · {t('linked.kind.' + (link.kind ?? 'web'))}{link.open === 'embed' ? ' · ' + t('linked.embedded') : ''}</span></li>}
            {link?.author && <li><b>{t('linked.author')}</b><span>{link.author}</span></li>}
            {!link && <li><b>{t('detail.storage')}</b><span>{story.local ? t('detail.storageLocal', { size: fmtBytes(size) }) : m.offlineEligible ? t('detail.storageOffline', { size: fmtBytes(size) }) : t('detail.storageOnline', { size: fmtBytes(size) })}</span></li>}
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
        </aside>
      </div>
      {sharing && <React.Suspense fallback={null}><ShareDialog title={title} url={shareTarget ?? deepLink} text={story.tagline} onClose={() => setSharing(false)} /></React.Suspense>}
    </main>
  )
}

/* The Living Shelf (§6.1). A cinematic Continue hero tinted by the book's
   own cover, shelves that reflect the reader's relationship with each
   title, fuzzy search, honest filters, and progress in story language —
   never a false percentage. */
import React, { useEffect, useMemo, useState } from 'react'
import { useApp } from '../context'
import { releaseFor, coverUrl, position, type CatalogStory } from '../lib/catalog'
import { primaryProgress, allDownloads } from '../lib/store'
import { accentFor, readableOn } from '../lib/accent'
import { fuzzySearch } from '../lib/fuzzy'
import { track } from '../lib/telemetry'
import { t } from '../lib/i18n'
import { Cover } from '../components/Cover'
import { SearchIcon, FilterIcon, ShelfIllustration } from '../components/Icons'

type Filters = { length: string[]; rating: string[]; access: string[]; status: string[]; offline: boolean }
const NO_FILTERS: Filters = { length: [], rating: [], access: [], status: [], offline: false }
const ACCESS_KEYS: [string, string][] = [['keyboard', 'access.keyboard'], ['screenReader', 'access.screenReader'], ['reducedMotion', 'access.reducedMotion'], ['untimedMode', 'access.untimed'], ['nonAudioAlternative', 'access.noAudio']]
const lengthOf = (s: CatalogStory) => {
  const max = releaseFor(s)?.meta?.estimatedMinutes?.total?.[1] ?? s.meta?.estimatedMinutes?.total?.[1] ?? 0
  return max < 30 ? 'short' : max <= 90 ? 'medium' : 'long'
}
const loadFilters = (): Filters => { try { return { ...NO_FILTERS, ...JSON.parse(sessionStorage.getItem('sf.filters') ?? '{}') } } catch { return NO_FILTERS } }

export function Shelf() {
  const { stories, catalogOffline, admin } = useApp()
  const [progress, setProgress] = useState<any[]>([])
  const [downloads, setDownloads] = useState<Map<string, any>>(new Map())
  const [q, setQ] = useState(() => sessionStorage.getItem('sf.q') ?? '')
  const [filters, setFilters] = useState<Filters>(loadFilters)
  const [showFilters, setShowFilters] = useState(false)
  const [accent, setAccent] = useState<string | null>(null)

  useEffect(() => {
    primaryProgress().then(setProgress)
    allDownloads().then((rows) => setDownloads(new Map(rows.map((r) => [String(r.key), r.value]))))
  }, [])
  useEffect(() => { stories?.forEach((s) => track('story_impression', { story_id: s.storyId, placement: 'shelf' })) }, [stories])
  useEffect(() => { try { sessionStorage.setItem('sf.q', q); sessionStorage.setItem('sf.filters', JSON.stringify(filters)) } catch { /* fine */ } }, [q, filters])

  const visible = useMemo(() => (stories ?? []).filter((s) => releaseFor(s, 'production') || admin), [stories, admin])
  const byStory = useMemo(() => new Map(progress.map((p) => [p.progress.storyId, p])), [progress])
  const downloadedSlugs = useMemo(() => new Set([...downloads.values()].map((d: any) => d.slug)), [downloads])
  const statusOf = (s: CatalogStory) => { const p = byStory.get(s.storyId); return !p ? 'unread' : p.progress.completion === 'completed' ? 'finished' : 'inProgress' }

  const heroEntry = progress.find((p) => p.progress.completion !== 'completed' && visible.some((s) => s.storyId === p.progress.storyId)) ?? progress[0]
  const hero = heroEntry ? visible.find((s) => s.storyId === heroEntry.progress.storyId) : null
  useEffect(() => {
    if (!hero) return
    const rel = releaseFor(hero)
    accentFor(hero.storyId, rel?.accent ?? hero.accent, coverUrl(hero, rel)).then(setAccent)
  }, [hero?.storyId])

  const filtering = !!q.trim() || filters.length.length + filters.rating.length + filters.access.length + filters.status.length > 0 || filters.offline
  const results = useMemo(() => {
    let list = visible.filter((s) => {
      const meta = releaseFor(s)?.meta ?? s.meta ?? {}
      if (filters.length.length && !filters.length.includes(lengthOf(s))) return false
      if (filters.rating.length && !filters.rating.includes(meta.content?.rating)) return false
      if (filters.access.some((k) => !meta.accessibility?.[k])) return false
      if (filters.status.length && !filters.status.includes(statusOf(s))) return false
      if (filters.offline && !(meta.offlineEligible || downloadedSlugs.has(s.slug))) return false
      return true
    })
    if (q.trim()) list = fuzzySearch(list, q, (s) => [[s.title, 3], [s.tagline ?? '', 1.5], [s.synopsis ?? '', 1], [(releaseFor(s)?.meta?.content?.warnings ?? []).join(' '), 0.8]])
    return list
  }, [visible, q, filters, byStory, downloadedSlugs])

  const toggle = (key: keyof Filters, value: string) => setFilters((f) => {
    const cur = f[key] as string[]
    return { ...f, [key]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] }
  })

  const card = (s: CatalogStory) => (
    <BookCard key={s.storyId} story={s} progress={byStory.get(s.storyId)} downloaded={downloads.has(releaseFor(s)?.releaseId ?? '')} />
  )
  const inProgress = visible.filter((s) => statusOf(s) === 'inProgress')
  const unread = visible.filter((s) => statusOf(s) === 'unread')
    .sort((a, b) => (releaseFor(b)?.publishedAt ?? '').localeCompare(releaseFor(a)?.publishedAt ?? ''))
  const finished = visible.filter((s) => statusOf(s) === 'finished')
  const downloaded = visible.filter((s) => downloads.has(releaseFor(s)?.releaseId ?? ''))

  return (
    <main className="page">
      <h1>{t('shelf.title')}</h1>
      <p className="lede">{t('shelf.lede')}{catalogOffline && <> <strong>{t('shelf.offline')}</strong></>}</p>

      {stories === null && <ShelfSkeleton />}

      {hero && !filtering && <Hero story={hero} entry={heroEntry} accent={accent} />}

      {visible.length > 0 && (
        <>
          <div className="toolbar" role="search">
            <div className="search">
              <SearchIcon />
              <label htmlFor="shelf-search" className="sr">{t('shelf.searchLabel')}</label>
              <input id="shelf-search" type="search" placeholder={t('shelf.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <button type="button" className="icon-btn" aria-expanded={showFilters} aria-controls="shelf-filters" onClick={() => setShowFilters(!showFilters)}>
              <FilterIcon /> {t('shelf.filters')}
            </button>
            {filtering && <button type="button" className="link-btn small" onClick={() => { setQ(''); setFilters(NO_FILTERS) }}>{t('shelf.filtersClear')}</button>}
          </div>
          {showFilters && (
            <div className="filters" id="shelf-filters">
              <div className="group" role="group" aria-label={t('filter.length')}><span>{t('filter.length')}</span>
                <Chip pressed={(filters.length as string[]).includes("short")} onClick={() => toggle('length', "short")} label={t('filter.short')} /><Chip pressed={(filters.length as string[]).includes("medium")} onClick={() => toggle('length', "medium")} label={t('filter.medium')} /><Chip pressed={(filters.length as string[]).includes("long")} onClick={() => toggle('length', "long")} label={t('filter.long')} />
              </div>
              <div className="group" role="group" aria-label={t('filter.rating')}><span>{t('filter.rating')}</span>
                {['everyone', 'teen', 'mature'].map((r) => <Chip key={r} pressed={(filters.rating as string[]).includes(r)} onClick={() => toggle('rating', r)} label={t('rating.' + r)} />)}
              </div>
              <div className="group" role="group" aria-label={t('filter.access')}><span>{t('filter.access')}</span>
                {ACCESS_KEYS.map(([k, label]) => <Chip key={k} pressed={(filters.access as string[]).includes(k)} onClick={() => toggle('access', k)} label={t(label)} />)}
              </div>
              <div className="group" role="group" aria-label={t('filter.status')}><span>{t('filter.status')}</span>
                <Chip pressed={(filters.status as string[]).includes("unread")} onClick={() => toggle('status', "unread")} label={t('status.unread')} /><Chip pressed={(filters.status as string[]).includes("inProgress")} onClick={() => toggle('status', "inProgress")} label={t('status.inProgress')} /><Chip pressed={(filters.status as string[]).includes("finished")} onClick={() => toggle('status', "finished")} label={t('status.finished')} />
                <button type="button" className="chip" aria-pressed={filters.offline} onClick={() => setFilters((f) => ({ ...f, offline: !f.offline }))}>{t('filter.offline')}</button>
              </div>
            </div>
          )}
        </>
      )}

      {filtering ? (
        <section aria-labelledby="results-h">
          <div className="section-head"><h2 id="results-h">{t('shelf.row.results')}</h2><span className="small muted" aria-live="polite">{t('shelf.results', { n: results.length, total: visible.length })}</span></div>
          {results.length ? <div className="grid-books">{results.map(card)}</div> : <p className="callout">{t('shelf.noResults')}</p>}
        </section>
      ) : (
        <>
          {inProgress.length > 1 && <Row id="row-continue" title={t('shelf.row.continue')}>{inProgress.map(card)}</Row>}
          {unread.length > 0 && unread.length < visible.length && <Row id="row-new" title={t('shelf.row.new')}>{unread.map(card)}</Row>}
          {finished.length > 0 && <Row id="row-finished" title={t('shelf.row.finished')}>{finished.map(card)}</Row>}
          {downloaded.length > 0 && <Row id="row-downloaded" title={t('shelf.row.downloaded')}>{downloaded.map(card)}</Row>}
          {visible.length > 0 && (
            <section aria-labelledby="row-all">
              <h2 id="row-all">{t('shelf.row.all')}</h2>
              <div className="grid-books shelf">{visible.map(card)}</div>
            </section>
          )}
        </>
      )}

      {stories !== null && visible.length === 0 && (
        <div className="empty">
          <ShelfIllustration />
          <h2>{t('shelf.emptyTitle')}</h2>
          <p>{catalogOffline ? t('shelf.emptyOffline') : t('shelf.emptyBody')}</p>
        </div>
      )}
    </main>
  )
}

function Chip({ pressed, onClick, label }: { pressed: boolean; onClick: () => void; label: string }) {
  return <button type="button" className="chip" aria-pressed={pressed} onClick={onClick}>{label}</button>
}

function Row({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      <div className="row">{children}</div>
    </section>
  )
}

function Hero({ story, entry, accent }: { story: CatalogStory; entry: any; accent: string | null }) {
  const rel = releaseFor(story)
  const pos = position(story, entry.progress.snapshot.checkpointId, rel)
  const done = entry.progress.completion === 'completed'
  const cover = coverUrl(story, rel)
  const dark = document.documentElement.dataset.scheme === 'dark'
  const ink = accent ? readableOn(accent, dark ? '#241F19' : '#FBF8F1') : undefined
  return (
    <section aria-label={t('shelf.continueKicker')} className="hero continue-card"
      style={{ ['--hero-accent' as any]: accent ?? undefined, ['--hero-ink' as any]: ink, ['--hero-cover' as any]: `url("${cover}")` }}>
      <Cover className="cover-3d" src={cover} title={story.title} />
      <div style={{ minWidth: 0 }}>
        <p className="kicker">{t('shelf.continueKicker')}</p>
        <h2>{story.title}</h2>
        <p className="where">{done ? t('shelf.finishedLine') : t('shelf.position', { label: pos.label, n: pos.index + 1, total: pos.total })}</p>
        <div className="btn-row" style={{ margin: 0 }}>
          <a className="btn" href={`#/play/${story.slug}`}>{t('shelf.continue')}</a>
          <a className="btn secondary" href={`#/story/${story.slug}`}>{t('shelf.details')}</a>
        </div>
      </div>
    </section>
  )
}

function BookCard({ story, progress, downloaded }: { story: CatalogStory; progress?: any; downloaded: boolean }) {
  const rel = releaseFor(story)
  const status = !progress ? 'unread' : progress.progress.completion === 'completed' ? 'finished' : 'inProgress'
  const recent = rel && Date.now() - Date.parse(rel.publishedAt) < 30 * 86400000
  const newEdition = progress && rel && progress.progress.releaseId && progress.progress.releaseId !== rel.releaseId
  const pos = progress && position(story, progress.progress.snapshot.checkpointId, rel)
  return (
    <a className="book story-card" href={`#/story/${story.slug}`} aria-label={`${story.title} — ${t('status.' + status)}`}>
      <span className="cover-wrap">
        <Cover src={coverUrl(story, rel)} title={story.title} />
        <span className="ribbon">
          {rel?.disabled && <span className="badge bad">{t('badge.paused')}</span>}
          {!rel && <span className="badge warn">{t('badge.noRelease')}</span>}
          {newEdition && <span className="badge info">{t('badge.newEdition')}</span>}
          {!progress && recent && <span className="badge">{t('badge.new')}</span>}
        </span>
      </span>
      <h3>{story.title}</h3>
      {status === 'inProgress' && pos ? <p className="where">{pos.label}</p> : <p className="tag">{story.tagline}</p>}
      <span className="badges">
        <span className={`badge ${status === 'finished' ? 'good' : ''}`}>{t('status.' + status)}</span>
        {downloaded && <span className="badge good">{t('badge.offline')}</span>}
      </span>
    </a>
  )
}

function ShelfSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="skeleton" style={{ height: '14rem', borderRadius: 18, marginBottom: '2rem' }} />
      <div className="grid-books">
        {Array.from({ length: 5 }, (_, i) => <div key={i}><div className="skeleton sk-cover" /><div className="skeleton sk-line" style={{ width: '70%' }} /><div className="skeleton sk-line" style={{ width: '45%' }} /></div>)}
      </div>
    </div>
  )
}

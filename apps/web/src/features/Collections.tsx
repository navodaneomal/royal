/* The Archive — a memory palace (§6.7, P0.8). Cross-story, spoiler-safe:
   discovered artifacts with their alt text and provenance, achievements
   (secret ones stay secret until earned), endings collected, notes and
   bookmarks, local reading stats, and a timeline tree where a reader can
   replay from any checkpoint they reached — a NEW timeline; the old one
   keeps every canonical choice exactly as made. */
import React, { useEffect, useState } from 'react'
import { useApp } from '../context'
import { releaseFor, checkpointLabel, coverUrl, type CatalogStory } from '../lib/catalog'
import {
  archiveEntries, achievementRows, allNotes, deleteNote, onNotesChange, timelinesFor, getProgress, replayPoints,
  replayFromCheckpoint, setPrimaryTimeline, allConflicts, resolveConflict, primaryProgress, type Note,
} from '../lib/store'
import { statsEnabled, statsSummary } from '../lib/stats'
import { accentFor } from '../lib/accent'
import { t, fmtDate } from '../lib/i18n'
import { Glyph } from '../components/Glyph'

export function Collections() {
  const { stories, toast } = useApp()
  const [found, setFound] = useState<any[]>([])
  const [achs, setAchs] = useState<any[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [filter, setFilter] = useState<string>('all')
  const [stats, setStats] = useState<any>(null)
  const [endings, setEndings] = useState<Record<string, Set<string>>>({})
  const [accents, setAccents] = useState<Record<string, string>>({})
  const [treeVersion, setTreeVersion] = useState(0)

  useEffect(() => {
    (async () => {
      setFound(await archiveEntries())
      setAchs(await achievementRows())
      setNotes(await allNotes())
      const prog = await primaryProgress()
      if (await statsEnabled()) setStats(await statsSummary(prog.filter((p) => p.progress.completion === 'completed').length))
    })()
    return onNotesChange(() => allNotes().then(setNotes)) as any
  }, [])
  useEffect(() => {
    if (!stories) return
    ;(async () => {
      const e: Record<string, Set<string>> = {}
      const a: Record<string, string> = {}
      for (const s of stories) {
        e[s.storyId] = new Set()
        for (const tl of await timelinesFor(s.storyId)) for (const id of (await getProgress(tl.id))?.snapshot?.endingIds ?? []) e[s.storyId].add(id)
        const rel = releaseFor(s)
        a[s.storyId] = await accentFor(s.storyId, rel?.accent ?? s.accent, coverUrl(s, rel))
      }
      setEndings(e); setAccents(a)
    })()
  }, [stories, treeVersion])

  const list = (stories ?? []).filter((s) => filter === 'all' || s.slug === filter)
  const achKeys = new Map(achs.map((a) => [`${a.storyId}:${a.achId}`, a]))

  return (
    <main className="page">
      <h1>{t('archive.title')}</h1>
      <p className="lede">{t('archive.lede')}</p>

      {(stories?.length ?? 0) > 1 && (
        <div className="story-tabs" role="group" aria-label={t('archive.all')}>
          <button type="button" className="chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>{t('archive.all')}</button>
          {stories!.map((s) => <button key={s.slug} type="button" className="chip" aria-pressed={filter === s.slug} onClick={() => setFilter(s.slug)}>{s.title}</button>)}
        </div>
      )}

      <section aria-labelledby="h-stats">
        <h2 id="h-stats">{t('archive.stats')}</h2>
        {stats ? (
          <div className="stats">
            <div className="stat"><b>{stats.totalMinutes}</b><span>{t('stats.minutes')}</span></div>
            <div className="stat"><b>{stats.finished}</b><span>{t('stats.finished')}</span></div>
            <div className="stat"><b>{stats.daysThisWeek}</b><span>{t('stats.days')}</span>
              <div className="week" aria-hidden="true" style={{ marginTop: '0.5rem' }}>{stats.week.map((d: any) => <i key={d.day} className={d.read ? 'on' : ''}>{new Date(d.day).toLocaleDateString(undefined, { weekday: 'narrow' })}</i>)}</div>
            </div>
            <div className="stat"><b>{stats.sessions}</b><span>{t('stats.sessions')}</span></div>
          </div>
        ) : <p className="small muted">{t('stats.off')} <a href="#/settings">{t('nav.settings')}</a></p>}
      </section>

      {list.map((s) => {
        const rel = releaseFor(s)
        const meta = rel?.meta ?? s.meta ?? {}
        const items = meta.items ?? []
        const achievements = meta.achievements ?? []
        const storyEndings = meta.endings ?? []
        const storyNotes = notes.filter((n) => n.storyId === s.storyId)
        const accent = accents[s.storyId]
        return (
          <section key={s.storyId} aria-label={`Collection for ${s.title}`} style={{ marginTop: '2.4rem' }}>
            <h2 style={{ fontSize: '1.5rem', borderBottom: '1px solid var(--line-2)', paddingBottom: '0.4rem' }}>{s.title}</h2>

            {items.length > 0 && <h3>{t('archive.items')}</h3>}
            <div className="grid-cards">
              {items.map((item: any) => {
                const rec = found.find((f) => f.storyId === s.storyId && f.itemId === item.id)
                return rec ? (
                  <article key={item.id} className="entry artifact">
                    <Glyph id={`${s.storyId}:${item.id}`} accent={accent} />
                    <div className="body">
                      <h3>{item.name}</h3>
                      <p className="meta">{t('archive.found', { date: fmtDate(rec.discoveredAt), where: checkpointLabel(s, rec.checkpointId, rel) })}</p>
                      {item.description && <p>{item.description}</p>}
                      <p className="altbox">{item.alt}</p>
                    </div>
                  </article>
                ) : (
                  <article key={item.id} className="entry artifact locked" aria-label={t('archive.undiscovered')}>
                    <Glyph id={item.id} locked />
                    <div className="body"><h3>· · ·</h3><p className="meta">{t('archive.sealed')}</p></div>
                  </article>
                )
              })}
            </div>

            {achievements.length > 0 && (
              <>
                <h3>{t('archive.achievements')}</h3>
                <div className="grid-cards">
                  {achievements.map((a: any) => {
                    const unlocked = achKeys.get(`${s.storyId}:${a.id}`)
                    if (a.secret && !unlocked) return <article key={a.id} className="entry locked"><h3>{t('archive.secret')}</h3><p className="meta">{t('archive.secretHint')}</p></article>
                    return (
                      <article key={a.id} className={`entry${unlocked ? '' : ' locked'}`}>
                        <h3>{unlocked ? '★ ' : ''}{a.name}</h3>
                        <p className="meta">{unlocked ? t('archive.unlocked', { date: fmtDate(unlocked.unlockedAt) }) : t('archive.notYet')}</p>
                        {a.description && <p>{a.description}</p>}
                      </article>
                    )
                  })}
                </div>
              </>
            )}

            {storyEndings.length > 0 && (
              <>
                <h3>{t('archive.endings')}</h3>
                <div className="grid-cards">
                  {storyEndings.map((e: any) => {
                    const got = endings[s.storyId]?.has(e.id)
                    return got
                      ? <article key={e.id} className="entry"><h3>❦ {e.name}</h3><p className="meta">{t('archive.endingReached')}</p></article>
                      : <article key={e.id} className="entry locked"><h3>· · ·</h3><p className="meta">{t('archive.endingSealed')}</p></article>
                  })}
                </div>
              </>
            )}

            {storyNotes.length > 0 && (
              <>
                <h3>{t('archive.notes')}</h3>
                <ul className="list">
                  {storyNotes.map((n) => (
                    <li key={n.id}>
                      <span className="grow"><span className="small muted">{n.kind === 'bookmark' ? t('notes.bookmark') : t('notes.note')} · {n.label ?? n.anchorId} · {fmtDate(n.at)}</span>{n.text && <><br />{n.text}</>}</span>
                      <button type="button" className="btn small secondary" onClick={async () => { await deleteNote(n.id); toast(t('notes.deleted')) }}>{t('common.delete')}</button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <TimelineTree story={s} version={treeVersion} onChange={() => setTreeVersion((v) => v + 1)} />
          </section>
        )
      })}

      {found.length === 0 && <p className="callout">{t('archive.empty')}</p>}
    </main>
  )
}

function TimelineTree({ story, version, onChange }: { story: CatalogStory; version: number; onChange: () => void }) {
  const { toast } = useApp()
  const [rows, setRows] = useState<any[]>([])
  const rel = releaseFor(story)

  useEffect(() => {
    (async () => {
      const tls = await timelinesFor(story.storyId)
      const conflicts = await allConflicts()
      const out = []
      for (const tl of tls) {
        out.push({
          tl, progress: await getProgress(tl.id), points: await replayPoints(tl.id),
          conflicts: conflicts.filter((c) => c.timelineId === tl.id && !c.resolved),
        })
      }
      setRows(out)
    })()
  }, [story.storyId, version])

  if (!rows.some((r) => r.progress)) return null
  const byParent = new Map<string | null, any[]>()
  for (const r of rows) {
    const parent = rows.some((x) => x.tl.id === r.tl.parentTimelineId) ? r.tl.parentTimelineId : null
    byParent.set(parent, [...(byParent.get(parent) ?? []), r])
  }
  const order = (id: string) => (rel?.meta?.checkpoints ?? []).find((c: any) => c.id === id)?.order ?? 0

  const replay = async (r: any, checkpointId: string | null) => {
    const label = checkpointId ? checkpointLabel(story, checkpointId, rel) : ''
    if (!confirm(checkpointId ? t('tree.replayConfirm', { label }) : t('tree.freshConfirm', { title: story.title }))) return
    await replayFromCheckpoint(story.storyId, r.tl.id, checkpointId, label)
    toast(t('tree.started'))
    onChange()
  }

  const render = (parent: string | null): React.ReactNode => (
    <ul className={parent ? undefined : 'tree'}>
      {(byParent.get(parent) ?? []).map((r) => (
        <li key={r.tl.id}>
          <div className={`node ${r.tl.isPrimary ? 'primary' : ''}`}>
            <span className="name">{r.tl.name}</span>
            {r.tl.isPrimary && <span className="badge good">{t('tree.current')}</span>}
            {r.progress && <span className="small muted">{checkpointLabel(story, r.progress.snapshot.checkpointId, rel)} · {t('tree.rev', { n: r.progress.revision })}</span>}
            {r.tl.forkedAtCheckpoint && <span className="small muted">{t('tree.forked', { label: checkpointLabel(story, r.tl.forkedAtCheckpoint, rel) })}</span>}
            <span className="btn-row" style={{ margin: 0 }}>
              {!r.tl.isPrimary && <button type="button" className="btn small secondary" onClick={async () => { await setPrimaryTimeline(r.tl.id); onChange() }}>{t('tree.makePrimary')}</button>}
              {r.points.length > 0 && (
                <select aria-label={t('tree.replay')} value="" onChange={(e) => { if (e.target.value) replay(r, e.target.value === '__fresh' ? null : e.target.value) }}>
                  <option value="">{t('tree.replay')}</option>
                  {[...r.points].sort((a: any, b: any) => order(a.key.split(':').pop()) - order(b.key.split(':').pop())).map((p: any) => {
                    const cp = p.key.slice(r.tl.id.length + 1)
                    return <option key={p.key} value={cp}>{t('tree.replayFrom', { label: checkpointLabel(story, cp, rel) })}</option>
                  })}
                  <option value="__fresh">{t('tree.fresh')}</option>
                </select>
              )}
            </span>
          </div>
          {r.conflicts.map((c: any) => (
            <div key={c.key} className="node" style={{ marginTop: '0.4rem', borderStyle: 'dashed' }}>
              <span className="name">{t('tree.divergence')}</span>
              <span className="small muted">{fmtDate(c.at)} · base {c.baseRevision} vs {c.currentRevision}</span>
              <span className="btn-row" style={{ margin: 0 }}>
                <button type="button" className="btn small secondary" onClick={async () => { await resolveConflict(c.key, 'candidate'); onChange() }}>{t('tree.restore')}</button>
                <button type="button" className="btn small ghost" onClick={async () => { await resolveConflict(c.key, 'current'); onChange() }}>{t('tree.dismiss')}</button>
              </span>
            </div>
          ))}
          {byParent.has(r.tl.id) && render(r.tl.id)}
        </li>
      ))}
    </ul>
  )

  return (
    <>
      <h3>{t('archive.timelines')}</h3>
      <p className="small muted">{t('tree.help')}</p>
      {render(null)}
    </>
  )
}

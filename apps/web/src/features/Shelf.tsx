/* The Living Shelf (§6.1): one Continue card above discovery, story cards
   that reflect the reader's relationship with each title, progress spoken
   in story language, never a false percentage. */
import React, { useEffect, useState } from 'react'
import { catalog, productionRelease, storyUrl, checkpointLabel } from '../lib/catalog'
import { allProgress, allDownloads } from '../lib/store'
import { track } from '../lib/telemetry'

export function Shelf() {
  const [stories, setStories] = useState<any[]>([])
  const [offline, setOffline] = useState(false)
  const [progress, setProgress] = useState<any[]>([])
  const [downloads, setDownloads] = useState<Set<string>>(new Set())

  useEffect(() => {
    (async () => {
      const { stories, offline } = await catalog()
      setStories(stories); setOffline(offline)
      setProgress(await allProgress())
      setDownloads(new Set((await allDownloads()).map((d) => String(d.key))))
      stories.forEach((s) => track('story_impression', { story_id: s.storyId, placement: 'shelf' }))
    })()
  }, [])

  const byStory = new Map(progress.map((p) => [p.progress.storyId, p]))
  const latest = progress[0] ?? null
  const latestStory = latest ? stories.find((s) => s.storyId === latest.progress.storyId) : null

  return (
    <main className="page">
      <h1>Your shelf</h1>
      <p className="lede">
        Stories here keep their own look and their own rules. The shelf keeps the memory.
        {offline && ' — Offline: showing the last catalog this device saw.'}
      </p>

      {latestStory && (
        <section aria-label="Continue reading" className="continue-card">
          <img src={storyUrl(latestStory.cover)} alt="" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ fontFamily: 'var(--serif)' }}>{latestStory.title}</strong>
            <p className="where">
              {latest.progress.completion === 'completed'
                ? 'Finished — the last page remembers you anyway.'
                : `${checkpointLabel(latestStory, latest.progress.snapshot.checkpointId)}`}
            </p>
            <a className="btn" href={`#/play/${latestStory.slug}`}>Continue</a>
          </div>
        </section>
      )}

      <div className="shelf">
        {stories.map((s) => {
          const rel = productionRelease(s)
          const p = byStory.get(s.storyId)
          const status = !p ? 'Unread'
            : p.progress.completion === 'completed' ? 'Completed'
            : 'In progress'
          return (
            <a key={s.storyId} className="story-card" href={`#/story/${s.slug}`}>
              <img src={storyUrl(s.cover)} alt="" onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden' }} />
              <span>
                <h3>{s.title}</h3>
                <p className="tag">{s.tagline}</p>
                <span className="badges">
                  <span className={`badge ${status === 'Completed' ? 'good' : ''}`}>{status}</span>
                  {p && p.progress.completion !== 'completed' && (
                    <span className="badge">{checkpointLabel(s, p.progress.snapshot.checkpointId)}</span>
                  )}
                  {rel && downloads.has(rel.releaseId) && <span className="badge good">Offline ready</span>}
                  {rel?.disabled && <span className="badge bad">Paused by operator</span>}
                  {!rel && <span className="badge warn">No production release</span>}
                </span>
              </span>
            </a>
          )
        })}
      </div>
      {stories.length === 0 && (
        <p className="callout">
          The catalog is empty or unreachable. Start the story host (<code className="mono">npm run host</code>)
          or publish a story (<code className="mono">npm run stories:publish</code>).
        </p>
      )}
    </main>
  )
}

/* The Archive + achievements (§6.7, P0.8): cross-story, spoiler-safe,
   with alt text and provenance. Secret achievements stay hidden until
   earned; undiscovered artifacts show as sealed slots, not spoilers. */
import React, { useEffect, useState } from 'react'
import { catalog } from '../lib/catalog'
import { archiveEntries, achievementRows } from '../lib/store'

export function Collections() {
  const [stories, setStories] = useState<any[]>([])
  const [found, setFound] = useState<any[]>([])
  const [achs, setAchs] = useState<any[]>([])

  useEffect(() => {
    (async () => {
      setStories((await catalog()).stories)
      setFound(await archiveEntries())
      setAchs(await achievementRows())
    })()
  }, [])

  const foundKeys = new Set(found.map((f) => `${f.storyId}:${f.itemId}`))
  const achKeys = new Set(achs.map((a) => `${a.storyId}:${a.achId}`))

  return (
    <main className="page">
      <h1>The Archive</h1>
      <p className="lede">Everything your journeys have surfaced, across every story. Undiscovered things stay undescribed.</p>

      {stories.map((s) => {
        const items = s.meta?.items ?? []
        const achievements = s.meta?.achievements ?? []
        if (!items.length && !achievements.length) return null
        return (
          <section key={s.storyId} aria-label={`Collection for ${s.title}`}>
            <h2>{s.title}</h2>
            <div className="grid-cards">
              {items.map((item: any) => {
                const rec = found.find((f) => f.storyId === s.storyId && f.itemId === item.id)
                return rec ? (
                  <article key={item.id} className="entry">
                    <h3>{item.name}</h3>
                    <p className="meta">
                      discovered {new Date(rec.discoveredAt).toLocaleDateString()} · at “{rec.checkpointId}”
                    </p>
                    <p>{item.description}</p>
                    <p className="altbox">{item.alt}</p>
                  </article>
                ) : (
                  <article key={item.id} className="entry locked" aria-label="An undiscovered artifact">
                    <h3>· · ·</h3>
                    <p className="meta">not yet discovered</p>
                  </article>
                )
              })}
            </div>

            {achievements.length > 0 && (
              <>
                <h2 style={{ fontSize: '1.02rem' }}>Achievements</h2>
                <div className="grid-cards">
                  {achievements.map((a: any) => {
                    const unlocked = achKeys.has(`${s.storyId}:${a.id}`)
                    if (a.secret && !unlocked) {
                      return (
                        <article key={a.id} className="entry locked"><h3>A secret</h3>
                          <p className="meta">stays a secret until you find it</p></article>
                      )
                    }
                    return (
                      <article key={a.id} className={`entry${unlocked ? '' : ' locked'}`}>
                        <h3>{a.name}</h3>
                        <p className="meta">{unlocked ? 'unlocked' : 'not yet'}</p>
                        <p>{a.description}</p>
                      </article>
                    )
                  })}
                </div>
              </>
            )}
          </section>
        )
      })}
      {found.length === 0 && <p className="callout">Nothing collected yet. Artifacts you discover inside stories appear here, with their provenance.</p>}
    </main>
  )
}

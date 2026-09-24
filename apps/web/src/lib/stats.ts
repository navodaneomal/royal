/* Reading stats — local only, opt-in, no guilt. Counts minutes actually
   spent with a story visible; streaks are phrased as "days you read this
   week", never as something you can lose. */
import { all, put } from './idb'
import { getKv } from './store'

const day = (d = new Date()) => d.toISOString().slice(0, 10)

export async function statsEnabled() { return !!(await getKv('readingStats', false)) }

/** Start timing a reading session; returns stop(). Only visible time counts. */
export function startSession(storyId: string) {
  let visibleSince = document.visibilityState === 'visible' ? Date.now() : 0
  let seconds = 0
  const onVis = () => {
    if (document.visibilityState === 'visible') visibleSince = Date.now()
    else if (visibleSince) { seconds += (Date.now() - visibleSince) / 1000; visibleSince = 0 }
  }
  document.addEventListener('visibilitychange', onVis)
  return async () => {
    document.removeEventListener('visibilitychange', onVis)
    if (visibleSince) seconds += (Date.now() - visibleSince) / 1000
    if (seconds < 20 || !(await statsEnabled())) return
    await put('sessions', undefined, { storyId, startedAt: new Date(Date.now() - seconds * 1000).toISOString(), seconds: Math.round(seconds), day: day() })
  }
}

export async function statsSummary(finishedCount = 0) {
  const rows = (await all('sessions')).map((r) => r.value as { storyId: string; seconds: number; day: string })
  const byStory: Record<string, number> = {}
  const days = new Set<string>()
  let total = 0
  for (const r of rows) { total += r.seconds; byStory[r.storyId] = (byStory[r.storyId] ?? 0) + r.seconds; days.add(r.day) }
  const last7 = Array.from({ length: 7 }, (_, i) => day(new Date(Date.now() - i * 86400000)))
  return {
    totalMinutes: Math.round(total / 60), byStory, sessions: rows.length,
    daysThisWeek: last7.filter((d) => days.has(d)).length,
    week: last7.reverse().map((d) => ({ day: d, read: days.has(d) })),
    finished: finishedCount,
  }
}

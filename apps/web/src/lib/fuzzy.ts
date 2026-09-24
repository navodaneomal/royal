/* Client-side fuzzy search — small, dependency-free, diacritic-insensitive.
   Every query token must match (AND); substring hits beat subsequences,
   word starts beat mid-word, titles beat taglines (field weights). */
const norm = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function scoreToken(token: string, text: string): number {
  const t = norm(text)
  const q = norm(token)
  if (!q) return 1
  const at = t.indexOf(q)
  if (at >= 0) return 100 - Math.min(at, 50) * 0.5 + (at === 0 || /\W/.test(t[at - 1]) ? 25 : 0)
  // typo-tolerant fallback: the token must be a subsequence of ONE word that
  // starts with the same letter (so "lghthouse" finds "lighthouse", but a
  // long synopsis can never spell a query out of scattered letters)
  let best = 0
  for (const word of t.split(/[^\p{L}\p{N}]+/u)) {
    if (!word || word[0] !== q[0] || word.length < q.length) continue
    let wi = 0, score = 0, streak = 0, ok = true
    for (const ch of q) {
      const found = word.indexOf(ch, wi)
      if (found < 0) { ok = false; break }
      streak = found === wi ? streak + 1 : 0
      score += 2 + streak * 3 - Math.min(found - wi, 5) * 0.6
      wi = found + 1
    }
    if (ok && q.length / word.length >= 0.6) best = Math.max(best, score)
  }
  return best
}

/** @param fields weighted texts per item: [[text, weight], …] */
export function fuzzySearch<T>(items: T[], query: string, fields: (item: T) => [string, number][]): T[] {
  const tokens = norm(query).split(/\s+/).filter(Boolean)
  if (!tokens.length) return items
  const scored = items.map((item) => {
    let total = 0
    for (const tok of tokens) {
      let best = 0
      for (const [text, w] of fields(item)) best = Math.max(best, scoreToken(tok, text ?? '') * w)
      if (!best) return { item, score: 0 }
      total += best
    }
    return { item, score: total }
  })
  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).map((s) => s.item)
}

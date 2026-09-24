/* A deterministic little artwork for an archive entry — shapes and hues
   derived from the item id and the story's accent. Decorative: the entry's
   alt text is rendered as real text right beside it. */
import React from 'react'

function hash(s: string) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) } return h >>> 0 }

export function Glyph({ id, accent = '#8A6420', locked = false }: { id: string; accent?: string; locked?: boolean }) {
  let h = hash(id)
  const next = () => { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0; return (h >>> 0) / 4294967296 }
  const shapes = Array.from({ length: 5 }, (_, i) => {
    const x = 20 + next() * 120, y = 12 + next() * 56, r = 6 + next() * 20
    const kind = Math.floor(next() * 3)
    const op = (0.18 + next() * 0.4).toFixed(2)
    if (kind === 0) return <circle key={i} cx={x} cy={y} r={r} fill={accent} opacity={op} />
    if (kind === 1) return <rect key={i} x={x - r} y={y - r / 2} width={r * 2} height={r} rx={r / 3} fill="currentColor" opacity={op} transform={`rotate(${(next() * 90 - 45).toFixed(0)} ${x} ${y})`} />
    return <path key={i} d={`M${x} ${y - r}L${x + r} ${y + r}H${x - r}Z`} fill={accent} opacity={op} />
  })
  return (
    <svg className="glyph" viewBox="0 0 160 90" aria-hidden="true" style={{ color: 'var(--ink-2)', background: 'var(--paper-2)' }}>
      {locked ? <text x="80" y="54" textAnchor="middle" fontSize="22" fill="currentColor" opacity=".35" fontFamily="var(--serif)">· · ·</text> : shapes}
    </svg>
  )
}

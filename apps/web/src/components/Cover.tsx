import React, { useState } from 'react'
/* Story cover with a graceful fallback (a typographic card) if it fails. */
export function Cover({ src, title, className, alt = '' }: { src: string; title: string; className?: string; alt?: string }) {
  const [broken, setBroken] = useState(false)
  if (broken) {
    return (
      <div className={className} role={alt ? 'img' : undefined} aria-label={alt || undefined}
        style={{ display: 'grid', placeItems: 'center', padding: '1rem', textAlign: 'center', fontFamily: 'var(--serif)', background: 'var(--paper-3)', color: 'var(--ink-2)', aspectRatio: '3 / 4' }}>
        {title}
      </div>
    )
  }
  return <img className={className} src={src} alt={alt} loading="lazy" decoding="async" onError={() => setBroken(true)} />
}

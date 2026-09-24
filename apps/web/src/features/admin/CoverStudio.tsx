/* Wizard step 4 — upload a cover, or generate a deterministic SVG one from
   title + palette + motif, with the title's contrast measured live. */
import React, { useEffect, useMemo, useState } from 'react'
import { generateCover, COVER_PALETTES, COVER_MOTIFS, toBytes } from '@storyframe/publishing'

export type CoverSettings = { palette: string; motif: string; typeface: string; subtitle: string; mode: 'generated' | 'uploaded' | 'existing' }

export function CoverStudio({ title, settings, files, coverPath, onSettings, onCover }: {
  title: string; settings: CoverSettings; files: Map<string, Uint8Array>; coverPath: string
  onSettings: (s: CoverSettings) => void
  onCover: (path: string, bytes: Uint8Array) => void
}) {
  const gen = useMemo(() => generateCover({ title: title || 'Untitled', subtitle: settings.subtitle, palette: settings.palette, motif: settings.motif, typeface: settings.typeface as any }), [title, settings])
  const current = files.get(coverPath)
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!current) { setUrl(null); return }
    const ext = coverPath.split('.').pop()!.toLowerCase()
    const mime = ({ svg: 'image/svg+xml', png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg' } as any)[ext] ?? 'image/png'
    const u = URL.createObjectURL(new Blob([current as BlobPart], { type: mime }))
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [current, coverPath])
  const genUrl = useMemo(() => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(gen.svg), [gen.svg])
  const set = (patch: Partial<CoverSettings>) => onSettings({ ...settings, ...patch })

  return (
    <div className="cover-studio">
      <div>
        <p className="small muted" style={{ marginTop: 0 }}>Current cover ({coverPath})</p>
        {url ? <img className="preview-cover" src={url} alt={`Current cover of ${title}`} /> : <div className="preview-cover skeleton" aria-label="No cover yet" role="img" />}
      </div>
      <div>
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Upload a cover</h3>
          <p className="small muted">SVG, PNG, WebP, or JPG. About 600×800 reads best on the shelf; keep it under 2 MB.</p>
          <input type="file" accept=".svg,.png,.webp,.jpg,.jpeg,image/*" aria-label="Upload a cover image" onChange={async (e) => {
            const f = e.target.files?.[0]
            if (!f) return
            const ext = (f.name.split('.').pop() ?? 'png').toLowerCase().replace('jpeg', 'jpg')
            onCover(`cover.${ext}`, new Uint8Array(await f.arrayBuffer()))
            set({ mode: 'uploaded' })
          }} />
        </div>
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>…or generate one</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(8rem, 10rem) 1fr', gap: '1rem', alignItems: 'start' }}>
            <img className="preview-cover" src={genUrl} alt={`Generated cover preview for ${title}`} style={{ boxShadow: 'var(--shadow)' }} />
            <div>
              <div className="field">
                <span className="label">Palette</span>
                <div className="swatches" role="group" aria-label="Palette">
                  {Object.entries(COVER_PALETTES).map(([name, p]: any) => (
                    <button key={name} type="button" className="swatch" aria-pressed={settings.palette === name} aria-label={name}
                      style={{ background: `linear-gradient(135deg, ${p.bg2}, ${p.bg} 60%, ${p.accent})` }} onClick={() => set({ palette: name })} />
                  ))}
                </div>
              </div>
              <div className="form-grid">
                <div className="field"><label htmlFor="cv-motif">Motif</label>
                  <select id="cv-motif" value={settings.motif} onChange={(e) => set({ motif: e.target.value })}>{COVER_MOTIFS.map((m: string) => <option key={m}>{m}</option>)}</select></div>
                <div className="field"><label htmlFor="cv-type">Typeface</label>
                  <select id="cv-type" value={settings.typeface} onChange={(e) => set({ typeface: e.target.value })}><option value="serif">Serif</option><option value="sans">Sans</option><option value="mono">Mono</option></select></div>
              </div>
              <div className="field"><label htmlFor="cv-sub">Subtitle (optional)</label>
                <input id="cv-sub" type="text" maxLength={48} value={settings.subtitle} onChange={(e) => set({ subtitle: e.target.value })} /></div>
              <p className={`small ${gen.ok ? '' : 'err'}`} role="status">
                Title contrast {gen.contrast.title}:1{settings.subtitle ? ` · subtitle ${gen.contrast.subtitle}:1` : ''} — {gen.ok ? 'passes 4.5:1 ✓' : `below 4.5:1 — pick another palette${gen.suggestion ? ` (ink ${gen.suggestion} would pass)` : ''}`}
              </p>
              <button type="button" className="btn" disabled={!gen.ok} onClick={() => { onCover('cover.svg', toBytes(gen.svg)); set({ mode: 'generated' }) }}>Use this cover</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

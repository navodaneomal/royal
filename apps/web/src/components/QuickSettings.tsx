/* The player's quick-settings drawer. Every change is written to the one
   preference profile and reaches the running story immediately as
   PREFERENCES_CHANGED over the bridge. Also lists this story's notes. */
import React, { useEffect, useState } from 'react'
import { useApp } from '../context'
import { useFocusTrap } from './Dialog'
import { t, fmtDate } from '../lib/i18n'
import { notesFor, deleteNote, onNotesChange, type Note } from '../lib/store'
import { CloseIcon } from './Icons'

export function Seg<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="field" role="group" aria-label={label}>
      <span className="label">{label}</span>
      <div className="seg">
        {options.map(([v, text]) => <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{text}</button>)}
      </div>
    </div>
  )
}

export function QuickSettings({ storyId, onClose }: { storyId: string; onClose: () => void }) {
  const { prefs, updatePrefs } = useApp()
  const ref = useFocusTrap(true, onClose)
  const [notes, setNotes] = useState<Note[]>([])
  useEffect(() => {
    const load = () => notesFor(storyId).then(setNotes)
    load()
    return onNotesChange(load) as any
  }, [storyId])

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside ref={ref} className="drawer" role="dialog" aria-modal="true" aria-labelledby="qs-title">
        <button type="button" className="icon-btn close" onClick={onClose} aria-label={t('common.close')}><CloseIcon /></button>
        <h2 id="qs-title">{t('drawer.title')}</h2>
        <p className="small muted">{t('drawer.live')}</p>
        <div className="field">
          <label htmlFor="qs-scale">{t('drawer.textSize')} ({Math.round(prefs.textScale * 100)}%)</label>
          <input id="qs-scale" data-autofocus type="range" min={0.8} max={2} step={0.1} value={prefs.textScale} onChange={(e) => updatePrefs({ textScale: Number(e.target.value) })} />
        </div>
        <Seg label={t('drawer.motion')} value={prefs.motion} options={[['full', t('motion.full')], ['reduced', t('motion.reduced')], ['none', t('motion.none')]]} onChange={(v) => updatePrefs({ motion: v })} />
        <Seg label={t('drawer.contrast')} value={prefs.contrast} options={[['normal', t('contrast.normal')], ['more', t('contrast.more')]]} onChange={(v) => updatePrefs({ contrast: v })} />
        <Seg label={t('drawer.scheme')} value={prefs.colorScheme} options={[['system', t('scheme.system')], ['light', t('scheme.light')], ['dark', t('scheme.dark')]]} onChange={(v) => updatePrefs({ colorScheme: v })} />
        <Seg label={t('drawer.type')} value={prefs.fontMode} options={[['story', t('font.story')], ['readable', t('font.readable')], ['dyslexia-friendly', t('font.dyslexia')]]} onChange={(v) => updatePrefs({ fontMode: v })} />
        <p><a href="#/settings" className="small">{t('drawer.allSettings')} →</a></p>

        <h2>{t('drawer.notes')}</h2>
        {!notes.length && <p className="small muted">{t('drawer.noNotes')}</p>}
        {notes.map((n) => (
          <div key={n.id} className="note-item">
            <div className="meta">{n.kind === 'bookmark' ? t('notes.bookmark') : t('notes.note')} · {n.label ?? n.anchorId} · {fmtDate(n.at)}</div>
            {n.text && <div>{n.text}</div>}
            <button type="button" className="link-btn small" onClick={() => deleteNote(n.id)}>{t('common.delete')}</button>
          </div>
        ))}
      </aside>
    </>
  )
}

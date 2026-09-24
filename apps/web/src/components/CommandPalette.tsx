/* Ctrl/⌘+K — go anywhere, open any story, flip a reading preference.
   ARIA combobox + listbox; fully keyboard driven. */
import React, { useMemo, useState } from 'react'
import { useApp } from '../context'
import { t } from '../lib/i18n'
import { fuzzySearch } from '../lib/fuzzy'
import { navigate } from '../lib/router'
import { useFocusTrap } from './Dialog'

type Cmd = { id: string; label: string; group: string; hint?: string; run: () => void; keywords?: string }

export function CommandPalette({ onClose, continueSlug }: { onClose: () => void; continueSlug?: { slug: string; title: string } | null }) {
  const app = useApp()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const ref = useFocusTrap(true, onClose)
  const p = app.prefs

  const commands = useMemo<Cmd[]>(() => {
    const go = t('cmd.groupGo'), st = t('cmd.groupStories'), rd = t('cmd.groupReading')
    const list: Cmd[] = [
      { id: 'shelf', label: t('cmd.shelf'), group: go, hint: 'g s', run: () => navigate('/') },
      { id: 'archive', label: t('cmd.archive'), group: go, hint: 'g a', run: () => navigate('/collections') },
      { id: 'offline', label: t('cmd.offline'), group: go, hint: 'g o', run: () => navigate('/offline') },
      { id: 'settings', label: t('cmd.settings'), group: go, hint: 'g t', run: () => navigate('/settings') },
    ]
    if (app.admin) list.push({ id: 'admin', label: t('cmd.admin'), group: go, run: () => navigate('/admin') })
    if (continueSlug) list.unshift({ id: 'continue', label: t('cmd.continue', { title: continueSlug.title }), group: st, run: () => navigate(`/play/${continueSlug.slug}`) })
    for (const s of app.stories ?? []) list.push({ id: 'open-' + s.slug, label: t('cmd.open', { title: s.title }), group: st, keywords: s.tagline, run: () => navigate(`/story/${s.slug}`) })
    list.push(
      { id: 'scheme', label: p?.colorScheme === 'dark' ? t('cmd.light') : t('cmd.dark'), group: rd, run: () => app.updatePrefs({ colorScheme: p?.colorScheme === 'dark' ? 'light' : 'dark' }) },
      { id: 'bigger', label: t('cmd.bigger'), group: rd, run: () => app.updatePrefs({ textScale: Math.min(2, Math.round((p.textScale + 0.1) * 10) / 10) }) },
      { id: 'smaller', label: t('cmd.smaller'), group: rd, run: () => app.updatePrefs({ textScale: Math.max(0.8, Math.round((p.textScale - 0.1) * 10) / 10) }) },
      { id: 'motion', label: p?.motion === 'full' ? t('cmd.motionOff') : t('cmd.motionOn'), group: rd, run: () => app.updatePrefs({ motion: p?.motion === 'full' ? 'reduced' : 'full' }) },
      { id: 'contrast', label: t('cmd.contrast'), group: rd, run: () => app.updatePrefs({ contrast: p?.contrast === 'more' ? 'normal' : 'more' }) },
      { id: 'onboarding', label: t('cmd.onboarding'), group: rd, run: () => app.openOnboarding() },
      { id: 'shortcuts', label: t('cmd.shortcuts'), group: rd, hint: '?', run: () => app.openShortcuts() },
    )
    return list
  }, [app.stories, app.admin, p, continueSlug])

  const results = q ? fuzzySearch(commands, q, (c) => [[c.label, 2], [c.keywords ?? '', 1], [c.group, 0.5]]) : commands
  const active = Math.min(sel, Math.max(0, results.length - 1))
  const run = (c?: Cmd) => { if (!c) return; onClose(); setTimeout(c.run, 0) }

  return (
    <div className="palette" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={ref} className="box" role="dialog" aria-modal="true" aria-label={t('palette.label')}>
        <input
          data-autofocus type="text" role="combobox" aria-expanded="true" aria-controls="palette-list"
          aria-activedescendant={results[active] ? `cmd-${results[active].id}` : undefined}
          aria-label={t('palette.label')} placeholder={t('palette.placeholder')} value={q}
          onChange={(e) => { setQ(e.target.value); setSel(0) }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)) }
            else if (e.key === 'Enter') { e.preventDefault(); run(results[active]) }
          }}
        />
        <ul id="palette-list" role="listbox" aria-label={t('palette.label')}>
          {results.map((c, i) => (
            <li key={c.id} id={`cmd-${c.id}`} role="option" aria-selected={i === active} onMouseEnter={() => setSel(i)} onClick={() => run(c)}>
              <span>{c.label}</span><span className="hint">{c.hint ? <kbd>{c.hint}</kbd> : c.group}</span>
            </li>
          ))}
          {!results.length && <li role="option" aria-selected="false" aria-disabled="true"><span className="muted">{t('palette.none')}</span></li>}
        </ul>
        <div className="foot" aria-hidden="true">{t('palette.foot')}</div>
      </div>
    </div>
  )
}

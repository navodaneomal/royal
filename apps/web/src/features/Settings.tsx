/* Settings (§8, §20.2): one accessibility profile for every story, applied
   live; privacy controls that tell the truth; recovery tools; and an honest
   account section — guest by default, cloud only when this library's
   operator configured it. */
import React, { useEffect, useState } from 'react'
import {
  getPreferences, profile, setConsent, exportEverything, deleteEverything,
  allProgress, listBackups, restoreBackup, getKv, setKv,
} from '../lib/store'
import { useApp } from '../context'
import { t, LOCALES } from '../lib/i18n'
import { CloudAccount } from './CloudAccount'
import { cloudEnabled } from '../lib/cloud'

function Sel({ p, save, k, label, hint, options }: { p: any; save: (patch: any) => void; k: string; label: string; hint?: string; options: [string, string][] }) {
  return (
    <div className="setting">
      <label htmlFor={`set-${k}`}>{label}</label>
      {hint && <span className="hint" id={`set-${k}-hint`}>{hint}</span>}
      <select id={`set-${k}`} value={p[k]} aria-describedby={hint ? `set-${k}-hint` : undefined} onChange={(e) => save({ [k]: e.target.value })}>
        {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
      </select>
    </div>
  )
}

export function SettingsView() {
  const { toast, updatePrefs, openOnboarding, stories } = useApp()
  const [p, setP] = useState<any>(null)
  const [me, setMe] = useState<any>(null)
  const [timelines, setTimelines] = useState<any[]>([])
  const [backups, setBackups] = useState<any[]>([])
  const [backupFor, setBackupFor] = useState('')
  const [statsOn, setStatsOn] = useState(false)
  const [ambient, setAmbientOn] = useState(false)

  useEffect(() => {
    (async () => {
      setP(await getPreferences())
      setMe(await profile())
      setTimelines(await allProgress())
      setStatsOn(await getKv('readingStats', false))
      setAmbientOn(await getKv('ambient', false))
    })()
  }, [])

  if (!p) return null
  const save = async (patch: any) => { await updatePrefs(patch); setP({ ...p, ...patch }) }
  const titleOf = (storyId: string) => stories?.find((s) => s.storyId === storyId)?.title ?? storyId.slice(0, 8)


  return (
    <main className="page">
      <h1>{t('settings.title')}</h1>
      <p className="lede">{t('settings.lede')}</p>

      <h2>{t('settings.reading')}</h2>
      <Sel p={p} save={save} k="colorScheme" label={t('settings.scheme')} options={[['system', t('scheme.system')], ['light', t('scheme.light')], ['dark', t('scheme.dark')]]} />
      <div className="setting">
        <label htmlFor="set-scale">{t('settings.textSize', { pct: Math.round(p.textScale * 100) })}</label>
        <input id="set-scale" type="range" min={0.8} max={2} step={0.1} value={p.textScale}
          onChange={(e) => save({ textScale: Number(e.target.value) })} />
      </div>
      <Sel p={p} save={save} k="lineHeight" label={t('settings.lineHeight')} options={[['compact', t('settings.lineCompact')], ['normal', t('settings.lineNormal')], ['relaxed', t('settings.lineRelaxed')]]} />
      <Sel p={p} save={save} k="fontMode" label={t('settings.typeface')} hint={t('settings.typefaceHint')}
        options={[['story', t('font.story')], ['readable', t('font.readable')], ['dyslexia-friendly', t('font.dyslexia')]]} />
      <Sel p={p} save={save} k="contrast" label={t('settings.contrast')} options={[['normal', t('contrast.normal')], ['more', t('contrast.more')]]} />
      {LOCALES.length > 1 && <Sel p={p} save={save} k="locale" label={t('settings.language')} hint={t('settings.languageHint')} options={LOCALES.map((l) => [l, l] as [string, string])} />}
      <div className="btn-row"><button className="btn secondary" onClick={openOnboarding}>{t('settings.onboarding')}</button></div>

      <h2>{t('settings.motionSound')}</h2>
      <Sel p={p} save={save} k="motion" label={t('settings.motion')} hint={t('settings.motionHint')}
        options={[['full', t('motion.full')], ['reduced', t('motion.reduced')], ['none', t('motion.none')]]} />
      <Sel p={p} save={save} k="sound" label={t('settings.sound')} options={[['muted', t('settings.soundMuted')], ['on', t('settings.soundOn')]]} />
      <div className="setting">
        <label className="switch"><input type="checkbox" checked={p.captions} onChange={(e) => save({ captions: e.target.checked })} /> {t('settings.captions')}</label>
      </div>
      <div className="setting">
        <label className="switch"><input type="checkbox" checked={ambient} disabled={p.sound !== 'on'}
          onChange={async (e) => { setAmbientOn(e.target.checked); await setKv('ambient', e.target.checked); save({}) }} /> {t('settings.ambient')}</label>
        <span className="hint">{t('settings.ambientHint')}</span>
      </div>

      <h2>{t('settings.puzzles')}</h2>
      <Sel p={p} save={save} k="puzzleAssist" label={t('settings.puzzleMode')} hint={t('settings.puzzleHint')}
        options={[['standard', t('onboard.puzzleStandard')], ['untimed', t('onboard.puzzleUntimed')], ['guided', t('onboard.puzzleGuided')]]} />

      <h2>{t('settings.privacy')}</h2>
      <div className="setting">
        <label className="switch">
          <input type="checkbox" checked={!!me?.analyticsConsent}
            onChange={async (e) => { await setConsent(e.target.checked); setMe({ ...me, analyticsConsent: e.target.checked }); toast(e.target.checked ? t('settings.analyticsOn') : t('settings.analyticsOff')) }} />
          {t('settings.analytics')}
        </label>
        <span className="hint">{t('settings.analyticsHint')}</span>
      </div>
      <div className="setting">
        <label className="switch">
          <input type="checkbox" checked={statsOn} onChange={async (e) => { setStatsOn(e.target.checked); await setKv('readingStats', e.target.checked) }} />
          {t('settings.stats')}
        </label>
        <span className="hint">{t('settings.statsHint')}</span>
      </div>
      <div className="btn-row">
        <button className="btn secondary" onClick={async () => {
          const data = await exportEverything()
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
          const a = document.createElement('a')
          a.href = URL.createObjectURL(blob); a.download = 'storyframe-export.json'; a.click()
          setTimeout(() => URL.revokeObjectURL(a.href), 1000)
        }}>{t('settings.export')}</button>
        <button className="btn danger" onClick={async () => {
          if (!confirm(t('settings.deleteConfirm'))) return
          await deleteEverything(); toast(t('settings.deleted')); location.hash = '#/'; location.reload()
        }}>{t('settings.deleteAll')}</button>
      </div>

      <h2>{t('settings.account')}</h2>
      {cloudEnabled() ? <CloudAccount /> : (
        <>
          <p className="callout">{t('settings.guest', { id: me?.id ?? '' })}</p>
          <p className="small muted">{t('settings.cloudOff')}</p>
        </>
      )}

      <h2>{t('settings.recovery')}</h2>
      <p className="small muted">{t('settings.recoveryHint')} <a href="#/collections">{t('nav.archive')}</a></p>
      {timelines.map(({ timeline, progress }) => (
        <div key={timeline.id} className="setting">
          <label>{titleOf(timeline.storyId)} · {timeline.name}</label>
          <span className="hint">revision {progress.revision} · checkpoint “{progress.snapshot.checkpointId}”</span>
          <div className="btn-row">
            <button className="btn secondary small" onClick={async () => { setBackupFor(timeline.id); setBackups(await listBackups(timeline.id)) }}>
              {t('settings.snapshots')}
            </button>
          </div>
          {backupFor === timeline.id && backups.map((b) => (
            <div key={b.key} className="btn-row" style={{ margin: '0.2rem 0' }}>
              <span className="hint">rev {b.revision} · {new Date(b.at).toLocaleString()} · “{b.snapshot.checkpointId}”{b.note ? ` · ${b.note}` : ''}</span>
              <button className="btn secondary small" onClick={async () => { await restoreBackup(timeline.id, b.key); toast(t('settings.restored')); setTimelines(await allProgress()) }}>
                {t('settings.restore')}
              </button>
            </div>
          ))}
        </div>
      ))}
      {timelines.length === 0 && <p className="hint">{t('settings.noProgress')}</p>}
    </main>
  )
}

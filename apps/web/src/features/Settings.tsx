/* Settings (§8, §20.2): one accessibility profile for every story, applied
   live; privacy controls that tell the truth; recovery tools for backups
   and archived timelines; honest account status for the local build. */
import React, { useEffect, useState } from 'react'
import {
  getPreferences, setPreferences, profile, setConsent,
  exportEverything, deleteEverything, openConflicts, resolveConflict,
  allProgress, listBackups, restoreBackup,
} from '../lib/store'
import { useApp } from '../main'

export function SettingsView() {
  const { toast, updatePrefs } = useApp()
  const [p, setP] = useState<any>(null)
  const [me, setMe] = useState<any>(null)
  const [conflicts, setConflicts] = useState<any[]>([])
  const [timelines, setTimelines] = useState<any[]>([])
  const [backups, setBackups] = useState<any[]>([])
  const [backupFor, setBackupFor] = useState('')

  useEffect(() => {
    (async () => {
      setP(await getPreferences())
      setMe(await profile())
      setConflicts(await openConflicts())
      setTimelines(await allProgress())
    })()
  }, [])

  if (!p) return null
  const save = async (patch: any) => { await updatePrefs(patch); setP({ ...p, ...patch }) }

  const Sel = ({ k, label, hint, options }: any) => (
    <div className="setting">
      <label htmlFor={`set-${k}`}>{label}</label>
      {hint && <span className="hint">{hint}</span>}
      <select id={`set-${k}`} value={p[k]} onChange={(e) => save({ [k]: e.target.value })}>
        {options.map(([v, t]: any) => <option key={v} value={v}>{t}</option>)}
      </select>
    </div>
  )

  return (
    <main className="page">
      <h1>Settings</h1>
      <p className="lede">One profile. Every story receives it, live, through the bridge — never renegotiated per title.</p>

      <h2>Reading and type</h2>
      <Sel k="colorScheme" label="Colour scheme" options={[['system', 'Match system'], ['light', 'Light'], ['dark', 'Dark']]} />
      <div className="setting">
        <label htmlFor="set-scale">Text size ({Math.round(p.textScale * 100)}%)</label>
        <input id="set-scale" type="range" min={0.8} max={2} step={0.1} value={p.textScale}
          onChange={(e) => save({ textScale: Number(e.target.value) })} />
      </div>
      <Sel k="lineHeight" label="Line spacing" options={[['compact', 'Compact'], ['normal', 'Normal'], ['relaxed', 'Relaxed']]} />
      <Sel k="fontMode" label="Typeface" hint="“Story” lets each story use its own type."
        options={[['story', 'Story-chosen'], ['readable', 'Readable sans'], ['dyslexia-friendly', 'Dyslexia-friendly']]} />
      <Sel k="contrast" label="Contrast" options={[['normal', 'Normal'], ['more', 'More contrast']]} />

      <h2>Motion and sound</h2>
      <Sel k="motion" label="Motion" hint="Stories must honour this — it is part of their release gate."
        options={[['full', 'Full'], ['reduced', 'Reduced'], ['none', 'None']]} />
      <Sel k="sound" label="Sound" options={[['muted', 'Muted until I opt in'], ['on', 'On']]} />
      <div className="setting">
        <label className="switch"><input type="checkbox" checked={p.captions} onChange={(e) => save({ captions: e.target.checked })} /> Captions where audio exists</label>
      </div>

      <h2>Puzzle assistance</h2>
      <Sel k="puzzleAssist" label="Puzzle mode" hint="Untimed and guided modes are never treated as failure."
        options={[['standard', 'Standard'], ['untimed', 'Untimed'], ['guided', 'Guided — offer hints sooner']]} />

      <h2>Privacy and data</h2>
      <div className="setting">
        <label className="switch">
          <input type="checkbox" checked={!!me?.analyticsConsent}
            onChange={async (e) => { await setConsent(e.target.checked); setMe({ ...me, analyticsConsent: e.target.checked }); toast(e.target.checked ? 'Product analytics on (stored on this device)' : 'Product analytics off') }} />
          Product analytics
        </label>
        <span className="hint">Off by default. Saves never depend on this. Events are name-allowlisted and stay in a local buffer in this build.</span>
      </div>
      <div className="btn-row">
        <button className="btn secondary" onClick={async () => {
          const data = await exportEverything()
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
          const a = document.createElement('a')
          a.href = URL.createObjectURL(blob); a.download = 'storyframe-export.json'; a.click()
          URL.revokeObjectURL(a.href)
        }}>Export my data</button>
        <button className="btn danger" onClick={async () => {
          if (!confirm('Delete all local Storyframe data — progress, downloads, archive, settings?')) return
          await deleteEverything(); toast('Everything deleted.'); location.hash = '#/'; location.reload()
        }}>Delete everything</button>
      </div>

      <h2>Account</h2>
      <p className="callout">
        You are reading as a <strong>guest</strong> (<code className="mono">{me?.id}</code>). Progress lives on this
        device only — that is the honest description of guest mode. Cloud sign-in (magic link) and cross-device sync
        are implemented server-side in <code className="mono">supabase/</code> and activate when a Supabase project is
        configured; this build ships with the local data plane. See <code className="mono">STATUS.md</code>.
      </p>

      <h2>Timelines and recovery</h2>
      {conflicts.length > 0 && conflicts.map((c) => (
        <div key={c.key} className="callout">
          <strong>Archived divergence</strong> — {new Date(c.at).toLocaleString()} (base {c.baseRevision} vs {c.currentRevision})
          <div className="btn-row">
            <button className="btn secondary" onClick={async () => { await resolveConflict(c.key, 'candidate'); setConflicts(await openConflicts()); toast('Archived attempt restored as latest.') }}>
              Restore this attempt
            </button>
            <button className="btn secondary" onClick={async () => { await resolveConflict(c.key, 'current'); setConflicts(await openConflicts()) }}>
              Dismiss
            </button>
          </div>
        </div>
      ))}
      {timelines.map(({ timeline, progress }) => (
        <div key={timeline.id} className="setting">
          <label>{timeline.name} · <code className="mono">{timeline.storyId.slice(0, 8)}</code></label>
          <span className="hint">revision {progress.revision} · checkpoint “{progress.snapshot.checkpointId}”</span>
          <div className="btn-row">
            <button className="btn secondary" onClick={async () => { setBackupFor(timeline.id); setBackups(await listBackups(timeline.id)) }}>
              Show snapshots ({'≤'}10 kept)
            </button>
          </div>
          {backupFor === timeline.id && backups.map((b) => (
            <div key={b.key} className="btn-row" style={{ margin: '0.2rem 0' }}>
              <span className="hint">rev {b.revision} · {new Date(b.at).toLocaleString()} · “{b.snapshot.checkpointId}”</span>
              <button className="btn secondary" onClick={async () => { await restoreBackup(timeline.id, b.key); toast('Snapshot restored as a new revision.'); setTimelines(await allProgress()) }}>
                Restore
              </button>
            </div>
          ))}
        </div>
      ))}
      {timelines.length === 0 && <p className="hint">No story progress yet.</p>}
    </main>
  )
}

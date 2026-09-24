/* The story player shell (§9.2) and the security boundary (§14).

   Online + separate story origin → sandbox="allow-scripts allow-same-origin
   allow-forms", exact-origin handshake. Same-origin preview or verified
   offline blob → OPAQUE sandbox ("allow-scripts allow-forms"): the frame
   gets a null origin and can never touch the application's storage,
   cookies, or DOM. Reader data crosses only on the private MessagePort,
   never in the wildcard welcome. ADR-0003 explains allow-forms.

   v2: immersive chrome that steps aside, fullscreen, a quick-settings
   drawer that pushes PREFERENCES_CHANGED live, bookmarks, protocol 1.1
   notes, beta previews on their own timeline, and snapshot migration when a
   reader resumes on a newer edition. */
import React, { useEffect, useRef, useState } from 'react'
import { createStoryBridge } from '@storyframe/bridge-host'
import { useApp } from '../context'
import { releaseFor, storyUrl, isCrossOrigin, checkpointLabel, manifestFor } from '../lib/catalog'
import {
  primaryTimeline, commitOperation, getPreferences, onPreferencesChange, openConflicts, resolveConflict,
  prepareResume, addNote, getProgress, archiveCloudDivergence,
} from '../lib/store'
import { cloudEnabled, pushOperation, keepThisDevice, adoptServer } from '../lib/cloud'
import { offlineEntryUrl, offlineReady } from '../lib/downloads'
import { track } from '../lib/telemetry'
import { startSession } from '../lib/stats'
import { t } from '../lib/i18n'
import { QuickSettings } from '../components/QuickSettings'
import { ExpandIcon, BookmarkIcon } from '../components/Icons'

const SAVE_KEYS: Record<string, string> = { idle: 'save.idle', saving: 'save.saving', saved: 'save.saved', synced: 'save.synced', offline: 'save.offline', attention: 'save.attention' }
const finePointer = () => matchMedia('(pointer: fine)').matches

export function Player({ slug, mode, channel = 'production' }: { slug: string; mode?: string; channel?: 'production' | 'beta' }) {
  const { toast, stories } = useApp()
  const shellRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const bridgeRef = useRef<any>(null)
  const blobRef = useRef<string | null>(null)
  const ctxRef = useRef<any>(null)
  const hideTimer = useRef<number>(0)
  const [state, setState] = useState<'loading' | 'running' | 'error' | 'disabled'>('loading')
  const [saveState, setSaveState] = useState('idle')
  const [title, setTitle] = useState(slug)
  const [diag, setDiag] = useState('')
  const [conflict, setConflict] = useState<any>(null)
  const [runId, setRunId] = useState(0)          // re-key to relaunch after conflict resolution
  const [chrome, setChrome] = useState<'shown' | 'hidden'>('shown')
  const [drawer, setDrawer] = useState(false)
  const [notice, setNotice] = useState<string | null>(channel === 'beta' ? t('player.beta') : null)
  const [fullscreen, setFullscreen] = useState(false)
  const [storyId, setStoryId] = useState('')

  /* ── chrome: step aside while reading (fine pointers only) ───────── */
  const showChrome = (sticky = false) => {
    setChrome('shown')
    clearTimeout(hideTimer.current)
    if (!sticky && finePointer()) hideTimer.current = window.setTimeout(() => {
      if (!shellRef.current?.querySelector('.player-bar')?.contains(document.activeElement)) setChrome('hidden')
    }, 3500)
  }
  useEffect(() => { if (state === 'running' && !drawer) showChrome(); else showChrome(true) }, [state, drawer])
  useEffect(() => () => clearTimeout(hideTimer.current), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (drawer || conflict) return
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName)
      if (e.key === 'Escape') { showChrome(); (shellRef.current?.querySelector('.player-bar a') as HTMLElement | null)?.focus() }
      else if (!typing && e.key === ',') { e.preventDefault(); setDrawer(true) }
      else if (!typing && e.key === 'f' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); toggleFullscreen() }
    }
    const onFs = () => setFullscreen(!!document.fullscreenElement)
    addEventListener('keydown', onKey)
    document.addEventListener('fullscreenchange', onFs)
    return () => { removeEventListener('keydown', onKey); document.removeEventListener('fullscreenchange', onFs) }
  }, [drawer, conflict])

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await shellRef.current?.requestFullscreen()
    } catch { /* not allowed here (iOS Safari) — nothing to do */ }
  }

  /* ── launch ──────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!stories) return
    let cancelled = false
    let cleanup = () => {}

    ;(async () => {
      const story = stories.find((s) => s.slug === slug)
      if (!story) { setState('error'); setDiag('story-missing'); return }
      setTitle(story.title)
      setStoryId(story.storyId)
      const release = releaseFor(story, channel)
      if (!release) { setState('error'); setDiag(channel === 'beta' ? 'no-beta-release' : 'no-release'); return }
      if (release.disabled) { setState('disabled'); return }

      const manifest = manifestFor(story, release)
      const timeline = await primaryTimeline(story.storyId, channel)
      const resume = await prepareResume(timeline.id, manifest, release.releaseId)
      if (resume.migrated) setNotice(t('player.migrated'))
      if ((resume as any).error === 'snapshot_newer_than_release') setNotice(t('player.newer'))
      const existing = resume.progress
      const prefs = await getPreferences()

      // pick the frame source + mode
      const wantOffline = mode === 'offline' || !navigator.onLine
      let src: string | null = null
      let bridgeMode: 'cross-origin-online' | 'opaque-offline'
      if (wantOffline && (await offlineReady(release.releaseId))) {
        src = await offlineEntryUrl(release.releaseId)
        blobRef.current = src
        bridgeMode = 'opaque-offline'
      } else if (wantOffline && !navigator.onLine) {
        setState('error'); setDiag('offline-not-downloaded'); return
      } else {
        src = storyUrl(release.path)
        bridgeMode = isCrossOrigin() ? 'cross-origin-online' : 'opaque-offline'
      }
      if (!src || cancelled) return

      const iframe = frameRef.current!
      iframe.setAttribute('sandbox', bridgeMode === 'cross-origin-online' ? 'allow-scripts allow-same-origin allow-forms' : 'allow-scripts allow-forms')
      ctxRef.current = { story, release, timeline }

      const bridge = createStoryBridge({
        iframe, mode: bridgeMode, src,
        release: { storyId: story.storyId, releaseId: release.releaseId, manifest, capabilities: manifest.capabilities },
        bootstrap: {
          resume: !!existing, revision: existing?.revision ?? 0,
          preferences: prefs, progress: existing?.snapshot ?? null,
        },
        callbacks: {
          async onCommit(payload: any) {
            const ack = await commitOperation({
              storyId: story.storyId, releaseId: release.releaseId, manifest,
              timelineId: timeline.id,
              operationId: payload.operationId, baseRevision: payload.baseRevision,
              mutation: payload.mutation,
            })
            if (payload.mutation.checkpointId) track('checkpoint_committed', { checkpoint_id: payload.mutation.checkpointId, revision: ack.revision, sync_mode: ack.sync })
            if (payload.mutation.type === 'ending') track('ending_reached', { ending_id: payload.mutation.endingId })
            if (payload.mutation.hintLevel) track('hint_accepted', { puzzle_id: payload.mutation.hintLevel.puzzleId, hint_level: payload.mutation.hintLevel.level })
            if (ack.status === 'conflict') {
              track('progress_conflict_detected', { story_id: story.storyId })
              const open = await openConflicts(timeline.id)
              setConflict({ story, timeline, entry: open[0] ?? null })
            }
            if (ack.status === 'accepted' && channel === 'production' && cloudEnabled()) {
              // local-first: the save already happened; the push only upgrades the chip
              pushOperation(timeline.id, { storyId: story.storyId, releaseId: release.releaseId, operationId: payload.operationId, mutation: payload.mutation })
                .then(async (r: any) => {
                  if (r.result === 'synced') setSaveState('synced')
                  if (r.result === 'conflict' && r.server) {
                    track('progress_conflict_detected', { story_id: story.storyId })
                    const entry = await archiveCloudDivergence(timeline.id, story.storyId, r.server, ack.revision)
                    setSaveState('attention')
                    setConflict({ story, timeline, entry, cloud: true })
                  }
                }).catch(() => { /* stays "saved on this device" — honest */ })
            }
            return ack
          },
          async onNote(note: any) {
            const saved = await addNote({ storyId: story.storyId, timelineId: timeline.id, anchorId: note.anchorId, label: note.label, kind: note.kind, text: note.text, source: 'story' })
            return { noteId: saved.id }
          },
          async onUiRequest(payload: any) {
            if (payload.request === 'exit') { location.hash = `#/story/${slug}`; return { status: 'ok' } }
            if (payload.request === 'toast') { toast(payload.text ?? ''); return { status: 'ok' } }
            if (payload.request === 'fullscreen') {
              try { await shellRef.current?.requestFullscreen() } catch { return { status: 'denied' } }
              return { status: 'ok' }
            }
            if (payload.request === 'report_issue') {
              track('story_runtime_error', { release_id: release.releaseId, error_code: 'reader-report' })
              toast('Thank you — the report includes release and checkpoint only.')
              return { status: 'ok' }
            }
            return { status: 'ok' }
          },
          onEvent(name: string, data: any) { track(name, { release_id: release.releaseId, mode: bridgeMode, ...('code' in (data ?? {}) ? { code: data.code } : {}) }) },
        },
      })
      bridgeRef.current = bridge
      setDiag(bridge.diagnosticId)

      let stopSession: null | (() => Promise<void>) = null
      const offStatus = bridge.onStatus((s: string) => {
        if (s === 'connected') { setState('running'); stopSession ??= startSession(story.storyId) }
        if (s === 'saving') setSaveState('saving')
        if (s === 'saved') setSaveState(navigator.onLine ? 'saved' : 'offline')
        if (s === 'conflict') setSaveState('attention')
        if (s === 'handshake_timeout') { setState('error') }
      })
      const offPrefs = onPreferencesChange((p: any) => bridge.sendPreferences(p))
      const onlineHandler = () => setSaveState((s) => (s === 'offline' ? 'saved' : s))
      const onVisibility = () => bridge.sendLifecycle(document.visibilityState === 'hidden' ? 'pause' : 'resume')
      addEventListener('online', onlineHandler)
      document.addEventListener('visibilitychange', onVisibility)

      cleanup = () => {
        offStatus(); (offPrefs as any)()
        removeEventListener('online', onlineHandler)
        document.removeEventListener('visibilitychange', onVisibility)
        bridge.close('navigation')
        if (blobRef.current) { URL.revokeObjectURL(blobRef.current); blobRef.current = null }
        stopSession?.()
        track('story_session_closed', { exit_reason: 'navigation' })
      }
    })()

    return () => { cancelled = true; cleanup() }
  }, [slug, mode, runId, channel, stories === null])

  async function decideConflict(choice: 'candidate' | 'current') {
    if (conflict?.entry) await resolveConflict(conflict.entry.key, choice)
    if (conflict?.cloud) {
      const c = ctxRef.current
      if (choice === 'current') await keepThisDevice(conflict.timeline.id, conflict.story.storyId, c?.release?.releaseId).catch(() => {})
      else await adoptServer(conflict.timeline.id, conflict.entry.currentRevision)
    }
    setConflict(null)
    setSaveState('idle')
    setRunId((n) => n + 1)   // relaunch pinned to the chosen timeline state
  }

  async function bookmark() {
    const c = ctxRef.current
    if (!c) return
    const p = await getProgress(c.timeline.id)
    const cp = p?.snapshot?.checkpointId ?? c.release.meta?.checkpoints?.[0]?.id ?? 'start'
    const label = checkpointLabel(c.story, cp, c.release)
    await addNote({ storyId: c.story.storyId, timelineId: c.timeline.id, anchorId: cp, label, kind: 'bookmark', text: '', source: 'shell' })
    toast(t('player.bookmarked', { label }))
  }

  const running = state === 'running'
  return (
    <div ref={shellRef} className="player" data-chrome={chrome} onMouseMove={(e) => { if (e.clientY < 80) showChrome() }}>
      <h1 className="sr">{title}</h1>
      <div className="hover-zone" aria-hidden="true" onMouseEnter={() => showChrome()} />
      <div className="player-bar" onFocus={() => showChrome(true)} onBlur={() => showChrome()} onMouseEnter={() => showChrome(true)} onMouseLeave={() => showChrome()}>
        <div className="left">
          <a className="btn secondary small" href={`#/story/${slug}`} aria-label={t('player.backLabel')}>{t('player.back')}</a>
          <span className="title">{title}</span>
        </div>
        <div className="right">
          <span className="savechip" data-state={saveState} role="status" aria-live="polite">{t(SAVE_KEYS[saveState])}</span>
          {running && <button type="button" className="btn secondary small hide-sm" onClick={bookmark} aria-label={t('player.bookmarkLabel')}><BookmarkIcon /> <span className="hide-sm">{t('player.bookmark')}</span></button>}
          <button type="button" className="btn secondary small" onClick={() => setDrawer(true)} aria-label={t('player.settingsLabel')} aria-haspopup="dialog">{t('player.settings')}</button>
          <button type="button" className="btn secondary small" onClick={toggleFullscreen} aria-label={fullscreen ? t('player.exitFullscreen') : t('player.fullscreen')} aria-pressed={fullscreen}><ExpandIcon /></button>
        </div>
      </div>

      {notice && running && (
        <div className="notice callout info" role="status">
          {notice} <button type="button" className="link-btn" onClick={() => setNotice(null)}>{t('common.close')}</button>
        </div>
      )}

      {state === 'disabled' && (
        <div className="player-error" role="alert">
          <h2>{t('player.pausedTitle')}</h2>
          <p>{t('player.pausedBody')}</p>
          <a className="btn" href="#/">{t('player.toShelf')}</a>
        </div>
      )}
      {state === 'error' && (
        <div className="player-error" role="alert">
          <h2>{t('player.errorTitle')}</h2>
          <p>{t('player.errorBody', { diag: diag || 'unknown' })}</p>
          <div className="btn-row" style={{ justifyContent: 'center' }}>
            <button className="btn" onClick={() => { setState('loading'); setRunId((n) => n + 1) }}>{t('player.retry')}</button>
            <a className="btn secondary" href="#/">{t('player.toShelf')}</a>
          </div>
        </div>
      )}
      {state !== 'disabled' && state !== 'error' && (
        <div className="stage">
          <iframe
            key={runId}
            ref={frameRef}
            title={t('player.frameTitle', { title })}
            allow="fullscreen"
            referrerPolicy="no-referrer"
            sandbox="allow-scripts allow-forms"
          />
        </div>
      )}

      {drawer && <QuickSettings storyId={storyId} onClose={() => setDrawer(false)} />}

      {conflict && (
        <div className="scrim" role="dialog" aria-modal="true" aria-labelledby="conflict-title">
          <div className="dialog">
            <h2 id="conflict-title">{t('player.conflictTitle')}</h2>
            <p>{t('player.conflictBody', { detail: conflict.entry ? ` (revision ${conflict.entry.baseRevision} vs ${conflict.entry.currentRevision})` : '' })}</p>
            <p style={{ fontStyle: 'italic' }}>
              {t('player.conflictLatest', { label: checkpointLabel(conflict.story, (conflict.entry?.candidate ?? {}).checkpointId ?? '') })}
            </p>
            <div className="btn-row">
              <button className="btn" onClick={() => decideConflict('current')}>{t('player.conflictKeep')}</button>
              <button className="btn secondary" onClick={() => decideConflict('candidate')}>{t('player.conflictUse')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

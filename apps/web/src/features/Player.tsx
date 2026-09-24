/* The story player shell (§9.2) and the security boundary (§14).

   Online + separate story origin → sandbox="allow-scripts allow-same-origin
   allow-forms", exact-origin handshake. Same-origin preview or verified
   offline blob → OPAQUE sandbox ("allow-scripts allow-forms"): the frame
   gets a null origin and can never touch the application's storage,
   cookies, or DOM. Reader data crosses only on the private MessagePort,
   never in the wildcard welcome.

   Why allow-forms is granted: text-input stories need working <form>
   submission for accessible command consoles. It adds no capability a
   script lacks — a sandboxed script can already navigate its own frame —
   and exfiltration routes stay closed by the publish-time external-origin
   scan, the story-host CSP (connect-src 'none'), and the rule that no
   secrets ever enter the frame (ADR-0003 discusses the boundary). */
import React, { useEffect, useRef, useState } from 'react'
import { createStoryBridge } from '@storyframe/bridge-host'
import { catalog, productionRelease, storyUrl, isCrossOrigin, checkpointLabel } from '../lib/catalog'
import { primaryTimeline, getProgress, commitOperation, getPreferences, onPreferencesChange, openConflicts, resolveConflict } from '../lib/store'
import { offlineEntryUrl, offlineReady } from '../lib/downloads'
import { track } from '../lib/telemetry'
import { useApp } from '../main'

const SAVE_LABELS: Record<string, string> = {
  idle: 'Ready', saving: 'Saving…', saved: 'Saved on this device',
  offline: 'Offline — saved on this device', attention: 'Sync needs attention',
}

export function Player({ slug, mode }: { slug: string; mode?: string }) {
  const { toast } = useApp()
  const frameRef = useRef<HTMLIFrameElement>(null)
  const bridgeRef = useRef<any>(null)
  const blobRef = useRef<string | null>(null)
  const [state, setState] = useState<'loading' | 'running' | 'error' | 'disabled'>('loading')
  const [saveState, setSaveState] = useState('idle')
  const [title, setTitle] = useState(slug)
  const [diag, setDiag] = useState('')
  const [conflict, setConflict] = useState<any>(null)
  const [runId, setRunId] = useState(0)          // re-key to relaunch after conflict resolution

  useEffect(() => {
    let cancelled = false
    let cleanup = () => {}

    ;(async () => {
      const { stories } = await catalog()
      const story = stories.find((s) => s.slug === slug)
      if (!story) { setState('error'); setDiag('story-missing'); return }
      setTitle(story.title)
      const release = productionRelease(story)
      if (!release) { setState('error'); setDiag('no-release'); return }
      if (release.disabled) { setState('disabled'); return }

      const timeline = await primaryTimeline(story.storyId)
      const existing = await getProgress(timeline.id)
      const prefs = await getPreferences()
      const manifest = {
        storyId: story.storyId, slug: story.slug, version: release.version,
        protocolVersion: story.meta.protocolVersion, stateSchemaVersion: story.meta.stateSchemaVersion,
        title: story.title, entrypoint: 'index.html',
        languages: story.meta.languages, defaultLanguage: story.meta.languages?.[0] ?? 'en',
        capabilities: story.meta.capabilities ?? [],
        content: story.meta.content, accessibility: story.meta.accessibility,
        offline: { eligible: !!story.meta.offlineEligible, required: [], optional: [], maxBytes: 50 * 1024 * 1024 },
        checkpoints: story.meta.checkpoints, items: story.meta.items,
        achievements: story.meta.achievements, choices: story.meta.choices, endings: story.meta.endings,
      }

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
        bridgeMode = isCrossOrigin ? 'cross-origin-online' : 'opaque-offline'
      }
      if (!src || cancelled) return

      const iframe = frameRef.current!
      iframe.setAttribute('sandbox', bridgeMode === 'cross-origin-online' ? 'allow-scripts allow-same-origin allow-forms' : 'allow-scripts allow-forms')

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
            return ack
          },
          async onUiRequest(payload: any) {
            if (payload.request === 'exit') { location.hash = `#/story/${slug}`; return { status: 'ok' } }
            if (payload.request === 'toast') { toast(payload.text ?? ''); return { status: 'ok' } }
            if (payload.request === 'fullscreen') {
              try { await iframe.requestFullscreen() } catch { return { status: 'denied' } }
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

      const offStatus = bridge.onStatus((s: string) => {
        if (s === 'connected') setState('running')
        if (s === 'saving') setSaveState('saving')
        if (s === 'saved') setSaveState(navigator.onLine ? 'saved' : 'offline')
        if (s === 'conflict') setSaveState('attention')
        if (s === 'handshake_timeout') { setState('error') }
      })
      const offPrefs = onPreferencesChange((p: any) => bridge.sendPreferences(p))
      const onlineHandler = () => setSaveState((s) => (s === 'offline' ? 'saved' : s))
      addEventListener('online', onlineHandler)

      cleanup = () => {
        offStatus(); (offPrefs as any)()
        removeEventListener('online', onlineHandler)
        bridge.close('navigation')
        if (blobRef.current) { URL.revokeObjectURL(blobRef.current); blobRef.current = null }
        track('story_session_closed', { exit_reason: 'navigation' })
      }
    })()

    return () => { cancelled = true; cleanup() }
  }, [slug, mode, runId])

  async function decideConflict(choice: 'candidate' | 'current') {
    if (conflict?.entry) await resolveConflict(conflict.entry.key, choice)
    setConflict(null)
    setSaveState('idle')
    setRunId((n) => n + 1)   // relaunch pinned to the chosen timeline state
  }

  return (
    <div className="player">
      <div className="player-bar">
        <div className="left">
          <a className="btn secondary" href={`#/story/${slug}`} aria-label="Back to story details">← Back</a>
          <span className="title">{title}</span>
        </div>
        <div className="right">
          <span className="savechip" data-state={saveState} role="status" aria-live="polite">{SAVE_LABELS[saveState]}</span>
          <a className="btn secondary" href="#/collections" aria-label="Open your archive">Archive</a>
        </div>
      </div>

      {state === 'disabled' && (
        <div className="player-error" role="alert">
          <h2>This story is paused</h2>
          <p>The operator disabled the current release. Your progress is safe on this device.</p>
          <a className="btn" href="#/">Back to the shelf</a>
        </div>
      )}
      {state === 'error' && (
        <div className="player-error" role="alert">
          <h2>The story could not start</h2>
          <p>Diagnostic <code className="mono">{diag || 'unknown'}</code>. Nothing was lost.</p>
          <div className="btn-row" style={{ justifyContent: 'center' }}>
            <button className="btn" onClick={() => { setState('loading'); setRunId((n) => n + 1) }}>Try again</button>
            <a className="btn secondary" href="#/">Back to the shelf</a>
          </div>
        </div>
      )}
      {state !== 'disabled' && state !== 'error' && (
        <iframe
          key={runId}
          ref={frameRef}
          title={`${title} — interactive story`}
          allow="fullscreen"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-forms"
        />
      )}

      {conflict && (
        <div className="scrim" role="dialog" aria-modal="true" aria-labelledby="conflict-title">
          <div className="dialog">
            <h2 id="conflict-title">Two timelines were found</h2>
            <p>
              This device tried to continue from an older moment than your latest confirmed save
              {conflict.entry ? ` (revision ${conflict.entry.baseRevision} vs ${conflict.entry.currentRevision})` : ''}.
              Nothing has been overwritten — both versions are kept.
            </p>
            <p style={{ fontStyle: 'italic' }}>
              Latest confirmed: “{checkpointLabel(conflict.story, (conflict.entry?.candidate ?? {}).checkpointId ?? '')}”
              — archived attempt is recoverable from Settings at any time.
            </p>
            <div className="btn-row">
              <button className="btn" onClick={() => decideConflict('current')}>Continue from latest save</button>
              <button className="btn secondary" onClick={() => decideConflict('candidate')}>Use the archived attempt</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

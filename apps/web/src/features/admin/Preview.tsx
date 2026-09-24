/* Wizard step 7 — run the compiled package exactly as readers will: a Blob
   URL inside an OPAQUE sandbox (allow-scripts allow-forms, origin "null"),
   the real bridge-host, and an in-memory store running the shared reducer.
   Nothing about the author's session (GitHub token included) is reachable
   from the frame: it has no origin, no storage, and only the bridge port. */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createStoryBridge } from '@storyframe/bridge-host'
import { applyMutation, buildRegistry, emptySnapshot, defaultPreferences, ManifestSchema } from '@storyframe/protocol'
import { stampReleaseFiles, toText } from '@storyframe/publishing'

type Log = { at: number; dir: 'in' | 'out' | 'ev'; text: string }
const SIMS: [string, string, Record<string, unknown>][] = [
  ['motion', 'Motion: none', { motion: 'none' }],
  ['text', 'Text 2×', { textScale: 2 }],
  ['dark', 'Dark', { colorScheme: 'dark' }],
  ['contrast', 'More contrast', { contrast: 'more' }],
  ['dyslexia', 'Dyslexia font', { fontMode: 'dyslexia-friendly' }],
  ['guided', 'Puzzles: guided', { puzzleAssist: 'guided' }],
]

export function Preview({ files, manifest, releaseId, packageHash }: { files: Map<string, Uint8Array>; manifest: any; releaseId: string; packageHash: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const bridgeRef = useRef<any>(null)
  const store = useRef<{ revision: number; snapshot: any | null; notes: any[] }>({ revision: 0, snapshot: null, notes: [] })
  const [device, setDevice] = useState<'phone' | 'tablet' | 'desktop'>('desktop')
  const [sims, setSims] = useState<Record<string, boolean>>({})
  const [log, setLog] = useState<Log[]>([])
  const [status, setStatus] = useState('starting')
  const [run, setRun] = useState(0)
  const [state, setState] = useState<any>(null)

  const parsed = useMemo(() => ManifestSchema.safeParse(manifest), [manifest])
  const prefs = () => ({ ...defaultPreferences(), ...Object.assign({}, ...SIMS.filter(([k]) => sims[k]).map(([, , p]) => p)) })
  const push = (dir: Log['dir'], text: string) => setLog((l) => [...l.slice(-199), { at: Date.now(), dir, text }])

  useEffect(() => {
    if (!parsed.success) return
    const m = parsed.data
    const registry = buildRegistry(m)
    const stamped = stampReleaseFiles(files, { entrypoint: m.entrypoint, releaseId, packageHash, generatedAt: new Date().toISOString() })
    const url = URL.createObjectURL(new Blob([toText(stamped.files.get(m.entrypoint)!)], { type: 'text/html' }))
    const iframe = frameRef.current!
    iframe.setAttribute('sandbox', 'allow-scripts allow-forms')     // opaque: never allow-same-origin here
    setStatus('handshake…')

    const bridge = createStoryBridge({
      iframe, mode: 'opaque-offline', src: url,
      release: { storyId: m.storyId, releaseId, manifest: m, capabilities: m.capabilities },
      bootstrap: { resume: !!store.current.snapshot, revision: store.current.revision, preferences: prefs(), progress: store.current.snapshot },
      callbacks: {
        async onCommit(payload: any) {
          const s = store.current
          if (payload.baseRevision !== s.revision) return { status: 'conflict', sync: 'conflict', revision: s.revision }
          const r = applyMutation(s.snapshot ?? emptySnapshot(m), payload.mutation, registry)
          if (!r.ok) { push('ev', `✗ commit rejected: ${r.code}${r.detail ? ' — ' + r.detail : ''}`); return { status: 'rejected', sync: 'local', revision: s.revision, code: r.code } }
          s.snapshot = r.snapshot
          s.revision += 1
          setState({ ...r.snapshot, revision: s.revision })
          return { status: 'accepted', sync: 'local', revision: s.revision }
        },
        async onNote(n: any) { store.current.notes.push(n); push('ev', `note saved on "${n.anchorId}" (${n.kind})`); return { noteId: 'preview-' + store.current.notes.length } },
        async onUiRequest(p: any) { push('ev', `ui request: ${p.request}${p.text ? ' — ' + p.text : ''}`); return { status: 'ok' } },
        onEvent(name: string, data: any) { push('ev', `${name}${data?.code ? ' (' + data.code + ')' : ''}${data?.protocol ? ' · protocol ' + data.protocol : ''}`) },
        onTrace(dir: 'in' | 'out', msg: any) {
          const payload = msg.payload ? JSON.stringify(msg.payload).slice(0, 140) : ''
          push(dir, `${dir === 'in' ? '←' : '→'} ${msg.type}${msg.sequence !== undefined ? ' #' + msg.sequence : ''} ${payload}`)
        },
      },
    })
    bridgeRef.current = bridge
    const off = bridge.onStatus((s: string) => setStatus(s))
    return () => { off(); bridge.close('preview-reload'); URL.revokeObjectURL(url) }
  }, [files, manifest, releaseId, run])

  // live preference delivery — exactly what the Player does
  useEffect(() => { bridgeRef.current?.sendPreferences(prefs()) }, [sims])

  if (!parsed.success) return <p className="callout bad">The manifest does not parse — fix it in the Manifest step first.</p>

  return (
    <div className="preview-shell">
      <div>
        <div className="btn-row" style={{ marginTop: 0 }}>
          <div className="seg" role="group" aria-label="Device">
            {(['phone', 'tablet', 'desktop'] as const).map((d) => <button key={d} type="button" aria-pressed={device === d} onClick={() => setDevice(d)}>{d[0].toUpperCase() + d.slice(1)}</button>)}
          </div>
          <button type="button" className="btn small secondary" onClick={() => setRun((n) => n + 1)}>Restart (keep progress)</button>
          <button type="button" className="btn small secondary" onClick={() => { store.current = { revision: 0, snapshot: null, notes: [] }; setState(null); setLog([]); setRun((n) => n + 1) }}>Reset progress</button>
          <span className="small muted" role="status">bridge: <strong data-testid="preview-status">{status}</strong></span>
        </div>
        <div className="device" data-device={device}>
          <iframe key={run} ref={frameRef} title={`Preview of ${manifest.title}`} referrerPolicy="no-referrer" sandbox="allow-scripts allow-forms" />
        </div>
      </div>
      <aside>
        <h3 style={{ marginTop: 0 }}>Reader preferences</h3>
        <p className="small muted">Toggle to see the book honour each one live (PREFERENCES_CHANGED).</p>
        <div className="chips" style={{ marginBottom: '1rem' }}>
          {SIMS.map(([k, label]) => <button key={k} type="button" className="chip" aria-pressed={!!sims[k]} onClick={() => setSims((s) => ({ ...s, [k]: !s[k] }))}>{label}</button>)}
        </div>
        <h3>Progress (in memory)</h3>
        {state ? (
          <ul className="small" style={{ paddingLeft: '1.1rem' }}>
            <li>revision {state.revision} · checkpoint <code className="mono">{state.checkpointId}</code></li>
            <li>items: {Object.keys(state.inventory).join(', ') || '—'}</li>
            <li>achievements: {state.achievements.join(', ') || '—'}</li>
            <li>choices: {Object.entries(state.committedChoices).map(([k, v]) => `${k}=${v}`).join(', ') || '—'}</li>
            <li>endings: {state.endingIds.join(', ') || '—'}</li>
          </ul>
        ) : <p className="small muted">No commits yet.</p>}
        <h3>Bridge log</h3>
        <ol className="log" aria-label="Bridge message log" data-testid="bridge-log">
          {log.map((l, i) => <li key={i} className={l.dir}>{l.text}</li>)}
        </ol>
      </aside>
    </div>
  )
}

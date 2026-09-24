/* Release management for one book: history with validation reports, the
   compatibility checker (beta vs production), a manifest diff between any
   two releases, and the operator actions — each behind a dialog that says
   exactly what will happen, each run by the real CLI (CI or dev host). */
import React, { useEffect, useState } from 'react'
import { checkCompatibility, diffManifests } from '@storyframe/publishing'
import { useApp } from '../../context'
import { releaseFor, fetchReleaseManifest, coverUrl, type CatalogStory } from '../../lib/catalog'
import { Dialog } from '../../components/Dialog'
import { Cover } from '../../components/Cover'
import { runOp, operatorMode, type OpAction, type OpUpdate, type OpMode } from './ops'

export function BookReleases({ slug }: { slug: string }) {
  const { stories, refreshCatalog } = useApp()
  const story = stories?.find((s) => s.slug === slug)
  const [mode, setMode] = useState<OpMode | null>(null)
  const [confirmOp, setConfirmOp] = useState<null | { action: OpAction; releaseId?: string; text: React.ReactNode; danger?: boolean }>(null)
  const [op, setOp] = useState<(OpUpdate & { action: string }) | null>(null)
  const [compat, setCompat] = useState<any>(null)
  const [diff, setDiff] = useState<{ a: string; b: string; rows: any[] | null }>({ a: '', b: '', rows: null })

  useEffect(() => { operatorMode().then(setMode) }, [])
  const prod = story ? releaseFor(story) : null
  const beta = story ? releaseFor(story, 'beta') : null
  useEffect(() => {
    setCompat(null)
    if (!story || !prod || !beta || prod.releaseId === beta.releaseId) return
    Promise.all([fetchReleaseManifest(story, prod.releaseId), fetchReleaseManifest(story, beta.releaseId)])
      .then(([cur, cand]) => setCompat(checkCompatibility(cur, cand))).catch((e) => setCompat({ error: e.message }))
  }, [story?.storyId, prod?.releaseId, beta?.releaseId])

  if (!story) return <p className="callout">No book with slug <code className="mono">{slug}</code> in the registry. <a href="#/admin">Back</a></p>

  const history = [...story.releases].reverse()
  const previous = (() => { const ids = story.releases.filter((r) => r.status !== 'rejected').map((r) => r.releaseId); const i = ids.indexOf(prod?.releaseId ?? ''); return i > 0 ? story.releases.find((r) => r.releaseId === ids[i - 1]) : null })()

  async function run(action: OpAction, releaseId?: string) {
    setConfirmOp(null)
    setOp({ action, phase: 'dispatching' })
    try {
      await runOp(action, { slug, releaseId }, (u) => setOp({ action, ...u }))
      await refreshCatalog()
    } catch (e: any) { setOp({ action, phase: 'error', message: e.message }) }
  }

  const ask = (action: OpAction, releaseId?: string) => {
    const rel = story.releases.find((r) => r.releaseId === releaseId)
    const texts: Record<string, React.ReactNode> = {
      promote: <>Production will point at <code className="mono">{releaseId}</code> (v{rel?.version}). New sessions get it; readers mid-session finish on their current edition. Nothing is deleted; you can roll back. {compat && !compat.error && !compat.ok && <strong> The compatibility check found blocking issues — the CLI will refuse this promotion.</strong>}</>,
      rollback: <>Production moves from <code className="mono">{prod?.releaseId}</code> (v{prod?.version}) back to <code className="mono">{previous?.releaseId}</code> (v{previous?.version}). Both releases stay stored forever.{(prod?.meta?.stateSchemaVersion ?? 1) > (previous?.meta?.stateSchemaVersion ?? 1) && <strong> This crosses a state-schema bump: readers who saved on the newer edition keep their saves, but the older edition may not recognise their latest checkpoint.</strong>}</>,
      disable: <>The kill switch: new launches of “{story.title}” stop and the shelf shows it as paused. Reader progress is untouched; enable again at any time.</>,
      enable: <>Readers can launch “{story.title}” again on <code className="mono">{prod?.releaseId}</code>.</>,
    }
    setConfirmOp({ action, releaseId, text: texts[action], danger: action === 'disable' || action === 'rollback' })
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <Cover className="thumb" src={coverUrl(story, prod ?? beta)} title={story.title} />
        <div><h2 style={{ margin: 0 }}>{story.title}</h2><code className="mono">{slug}</code> · <span className="small">storyId <code className="mono">{story.storyId}</code></span></div>
      </div>

      <div className="tiles" style={{ marginTop: '1rem' }}>
        <div className="tile"><b>{prod ? `v${prod.version}` : '—'}</b><span>production {prod ? prod.releaseId : ''}{prod?.disabled ? ' · DISABLED' : ''}</span></div>
        <div className="tile"><b>{beta ? `v${beta.version}` : '—'}</b><span>beta {beta ? beta.releaseId : ''}</span></div>
        <div className="tile"><b>{story.releases.length}</b><span>immutable releases</span></div>
      </div>

      <div className="btn-row">
        {beta && <a className="btn secondary" href={`#/play/${slug}?channel=beta`}>Preview beta in the app</a>}
        {beta && beta.releaseId !== prod?.releaseId && <button className="btn" onClick={() => ask('promote', beta.releaseId)}>Promote beta to production</button>}
        {previous && <button className="btn secondary" onClick={() => ask('rollback')}>Roll back production</button>}
        {prod && (prod.disabled
          ? <button className="btn secondary" onClick={() => ask('enable')}>Enable</button>
          : <button className="btn danger" onClick={() => ask('disable')}>Disable (kill switch)</button>)}
      </div>
      {mode === 'cli' && <p className="small muted">Read-only here: actions will show the CLI command to run. <a href="#/admin/connect">Connect GitHub</a> to run them from this page.</p>}

      {op && (
        <div className={`callout ${op.phase === 'error' || (op.phase === 'completed' && op.conclusion !== 'success') ? 'bad' : op.phase === 'completed' || op.phase === 'done' ? 'good' : 'info'}`} role="status" aria-live="polite">
          <strong>{op.action}</strong>: {op.cli ? <>run <code className="mono">{op.cli}</code> where the content branch is checked out, then redeploy (DEPLOY.md).</> : <>
            <span className={`status-dot ${op.phase === 'completed' || op.phase === 'done' ? (op.conclusion === 'success' || op.phase === 'done' ? 'good' : 'bad') : op.phase === 'error' ? 'bad' : 'run'}`} />
            {op.phase}{op.conclusion ? ` · ${op.conclusion}` : ''}{op.message ? ` — ${op.message}` : ''} {op.url && <a href={op.url} target="_blank" rel="noreferrer">open the run</a>}
          </>}
        </div>
      )}

      <h2>Compatibility: beta → production</h2>
      {!beta || beta.releaseId === prod?.releaseId ? <p className="small muted">Beta and production are the same release — nothing to compare.</p>
        : !compat ? <p className="small muted">Checking…</p>
        : compat.error ? <p className="callout bad">Could not load manifests: {compat.error}</p>
        : (
          <div className={`callout ${compat.ok ? 'good' : 'bad'}`}>
            {compat.ok ? '✓ Readers mid-story can resume on the beta.' : '✗ Promotion is blocked:'}
            {!compat.ok && <ul>{compat.blocking.map((b: any, i: number) => <li key={i}>{b.message}<br /><span className="small">{b.fix}</span></li>)}</ul>}
            {compat.warnings.length > 0 && <ul className="small">{compat.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}</ul>}
            {compat.requiresMigration && compat.ok && <p className="small">IDs changed, and the migration map covers every one (stateSchemaVersion {compat.schema.from} → {compat.schema.to}).</p>}
          </div>
        )}

      <h2>Release history</h2>
      <div className="table-wrap">
        <table className="op">
          <thead><tr><th>Version</th><th>Release</th><th>Hash</th><th>Published</th><th>Validation</th><th>Channels</th><th></th></tr></thead>
          <tbody>
            {history.map((r) => (
              <tr key={r.releaseId}>
                <td>v{r.version}</td>
                <td><code className="mono">{r.releaseId}</code></td>
                <td><code className="mono small">{r.packageHash?.slice(0, 16)}…</code></td>
                <td className="small">{new Date(r.publishedAt).toLocaleString()}</td>
                <td>{r.validation?.warnings?.length ? <details><summary className="badge warn">{r.validation.warnings.length} warning(s)</summary><ul className="small">{r.validation.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></details> : <span className="badge good">clean</span>}</td>
                <td>{prod?.releaseId === r.releaseId && <span className="badge good">production</span>} {beta?.releaseId === r.releaseId && <span className="badge info">beta</span>}</td>
                <td>{prod?.releaseId !== r.releaseId && <button className="btn small secondary" onClick={() => ask('promote', r.releaseId)}>Promote</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Manifest diff</h2>
      <div className="btn-row">
        {(['a', 'b'] as const).map((k) => (
          <label key={k} className="small">{k === 'a' ? 'From' : 'To'}{' '}
            <select value={diff[k]} onChange={(e) => setDiff({ ...diff, [k]: e.target.value, rows: null })}>
              <option value="">choose…</option>
              {history.map((r) => <option key={r.releaseId} value={r.releaseId}>v{r.version} · {r.releaseId}</option>)}
            </select>
          </label>
        ))}
        <button className="btn small" disabled={!diff.a || !diff.b || diff.a === diff.b} onClick={async () => {
          const [a, b] = await Promise.all([fetchReleaseManifest(story, diff.a), fetchReleaseManifest(story, diff.b)])
          setDiff({ ...diff, rows: diffManifests(a, b) })
        }}>Compare</button>
      </div>
      {diff.rows && (diff.rows.length ? (
        <div className="table-wrap"><table className="op diff">
          <thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead>
          <tbody>{diff.rows.map((r, i) => <tr key={i}><td><code className="mono">{r.field}</code></td><td className="before"><pre className="pre">{JSON.stringify(r.before, null, 1) ?? '—'}</pre></td><td className="after"><pre className="pre">{JSON.stringify(r.after, null, 1) ?? '—'}</pre></td></tr>)}</tbody>
        </table></div>
      ) : <p className="small muted">The manifests are identical.</p>)}

      {confirmOp && (
        <Dialog title={`${confirmOp.action[0].toUpperCase() + confirmOp.action.slice(1)} “${story.title}”?`} onClose={() => setConfirmOp(null)}>
          <p>{confirmOp.text}</p>
          <p className="small muted">{mode === 'github' ? 'This starts the publish workflow on GitHub; the CLI does the work and the audit log records you as the actor.' : mode === 'dev' ? 'This calls the dev story host’s admin API.' : 'You will get the exact CLI command to run.'}</p>
          <div className="btn-row">
            <button className={`btn ${confirmOp.danger ? 'danger' : ''}`} data-autofocus onClick={() => run(confirmOp.action, confirmOp.releaseId)}>Yes, {confirmOp.action}</button>
            <button className="btn secondary" onClick={() => setConfirmOp(null)}>Cancel</button>
          </div>
        </Dialog>
      )}
    </div>
  )
}

/* Admin dashboard: every book with its channels, size, last publish,
   validation warnings, and latest CI run; the audit log with filters; and
   health tiles from this device's telemetry buffer (honestly labelled). */
import React, { useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context'
import { releaseFor, storyUrl, coverUrl, type CatalogStory } from '../../lib/catalog'
import { telemetrySummary } from '../../lib/telemetry'
import { fmtBytes } from '../../lib/i18n'
import { Cover } from '../../components/Cover'
import { gh, operatorMode, type OpMode } from './ops'
import type { Run } from '../../lib/github'

const runTone = (r?: Run) => !r ? '' : r.status !== 'completed' ? 'run' : r.conclusion === 'success' ? 'good' : 'bad'
const runText = (r?: Run) => !r ? '—' : r.status !== 'completed' ? r.status.replace('_', ' ') : r.conclusion ?? 'done'

export function Dashboard() {
  const { stories, refreshCatalog } = useApp()
  const [audit, setAudit] = useState<any[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [mode, setMode] = useState<OpMode | null>(null)
  const [tele, setTele] = useState<any>(null)
  const [f, setF] = useState({ action: '', slug: '', actor: '', from: '', to: '' })

  useEffect(() => {
    refreshCatalog()
    operatorMode().then(setMode)
    telemetrySummary().then(setTele)
    fetch(storyUrl('audit-log.json'), { cache: 'no-store' }).then((r) => (r.ok ? r.json() : [])).then((a) => setAudit([...a].reverse())).catch(() => setAudit([]))
  }, [])
  useEffect(() => {
    const client = gh()
    if (!client) return
    let alive = true
    const load = () => client.runs({ per_page: 20 }).then((r) => { if (alive) setRuns(r) }).catch(() => {})
    load()
    const timer = setInterval(load, 15000)
    return () => { alive = false; clearInterval(timer) }
  }, [mode])

  const latestRun = (slug: string) => runs.find((r) => r.display_title.includes(slug))
  const filtered = useMemo(() => audit.filter((a) =>
    (!f.action || a.action === f.action) && (!f.slug || a.slug === f.slug) && (!f.actor || String(a.actor ?? '').toLowerCase().includes(f.actor.toLowerCase()))
    && (!f.from || a.at >= f.from) && (!f.to || a.at <= f.to + 'T23:59:59Z')), [audit, f])
  const actions = [...new Set(audit.map((a) => a.action))].sort()
  const list = stories ?? []

  return (
    <div>
      <p className={`callout ${mode === 'cli' ? '' : 'good'}`}>
        {mode === 'github' && <>Connected to GitHub — publishing and operator actions run the real CLI in CI, with live status here.</>}
        {mode === 'dev' && <>Local dev: operator actions use the dev story host’s admin API.</>}
        {mode === 'cli' && <>Read-only on this deployment. <a href="#/admin/connect">Connect GitHub</a> to publish and operate — or run the CLI commands shown on each book.</>}
        {mode === null && <>Checking…</>}
      </p>

      <div className="tiles">
        <div className="tile"><b>{list.length}</b><span>books in the registry</span></div>
        <div className="tile"><b>{list.filter((s) => releaseFor(s)).length}</b><span>on the production shelf</span></div>
        <div className="tile"><b>{list.filter((s) => releaseFor(s, 'beta') && releaseFor(s, 'beta')!.releaseId !== releaseFor(s)?.releaseId).length}</b><span>betas awaiting promotion</span></div>
        <div className="tile"><b>{list.filter((s) => releaseFor(s)?.disabled).length}</b><span>paused (kill switch)</span></div>
      </div>

      <div className="section-head"><h2>Books</h2><a className="btn small" href="#/admin/new">New book</a></div>
      <div className="table-wrap">
        <table className="op">
          <thead><tr><th>Book</th><th>Production</th><th>Beta</th><th>Size</th><th>Last publish</th><th>Warnings</th><th>CI</th><th></th></tr></thead>
          <tbody>
            {list.map((s: CatalogStory) => {
              const prod = releaseFor(s), beta = releaseFor(s, 'beta')
              const last = [...s.releases].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0]
              const warns = (beta ?? prod)?.validation?.warnings?.length ?? 0
              const run = latestRun(s.slug)
              return (
                <tr key={s.storyId}>
                  <td style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}><Cover className="thumb" src={coverUrl(s, prod ?? beta)} title={s.title} /><span><strong>{s.title}</strong><br /><code className="mono">{s.slug}</code></span></td>
                  <td>{prod ? <><code className="mono">{prod.releaseId}</code><br /><span className="small">v{prod.version}</span>{prod.disabled && <> <span className="badge bad">disabled</span></>}</> : <span className="muted">—</span>}</td>
                  <td>{beta ? <><code className="mono">{beta.releaseId}</code><br /><span className="small">v{beta.version}</span>{beta.releaseId === prod?.releaseId && <span className="small muted"> (same)</span>}</> : <span className="muted">—</span>}</td>
                  <td>{fmtBytes((prod ?? beta)?.meta?.sizeBytes ?? 0)}</td>
                  <td className="small">{last ? new Date(last.publishedAt).toLocaleString() : '—'}</td>
                  <td>{warns ? <span className="badge warn">{warns}</span> : <span className="badge good">0</span>}</td>
                  <td className="small">{run ? <a href={run.html_url} target="_blank" rel="noreferrer"><span className={`status-dot ${runTone(run)}`} />{runText(run)}</a> : <span className="muted">—</span>}</td>
                  <td><a className="btn small secondary" href={`#/admin/book/${s.slug}`}>Manage</a></td>
                </tr>
              )
            })}
            {!list.length && <tr><td colSpan={8}>No books yet — <a href="#/admin/new">publish your first</a>.</td></tr>}
          </tbody>
        </table>
      </div>

      {runs.length > 0 && (
        <>
          <h2>Recent workflow runs</h2>
          <ul className="list">
            {runs.slice(0, 8).map((r) => (
              <li key={r.id}><span className="grow"><span className={`status-dot ${runTone(r)}`} /><a href={r.html_url} target="_blank" rel="noreferrer">{r.display_title}</a> <span className="small muted">· {r.name} · {r.event} · {new Date(r.created_at).toLocaleString()}{r.actor ? ` · ${r.actor.login}` : ''}</span></span><span className="small">{runText(r)}</span></li>
            ))}
          </ul>
        </>
      )}

      <h2>Audit log</h2>
      <div className="filters" role="group" aria-label="Filter the audit log">
        <div className="group">
          <label className="small">Action <select value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })}><option value="">all</option>{actions.map((a) => <option key={a}>{a}</option>)}</select></label>
          <label className="small">Book <select value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })}><option value="">all</option>{list.map((s) => <option key={s.slug}>{s.slug}</option>)}</select></label>
          <label className="small">Actor <input type="text" value={f.actor} onChange={(e) => setF({ ...f, actor: e.target.value })} style={{ width: '9rem' }} /></label>
          <label className="small">From <input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
          <label className="small">To <input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
        </div>
      </div>
      <div className="table-wrap">
        <table className="op">
          <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Book</th><th>Detail</th></tr></thead>
          <tbody>
            {filtered.slice(0, 100).map((a, i) => (
              <tr key={i}>
                <td className="small">{new Date(a.at).toLocaleString()}</td>
                <td>{a.actor}</td>
                <td><code className="mono">{a.action}</code></td>
                <td>{a.slug ?? ''}</td>
                <td className="small">{a.releaseId ?? ''} {a.version ? `v${a.version}` : ''} {a.channel ? `→ ${a.channel}` : ''}{a.from ? ` (${a.from} → ${a.to ?? a.releaseId})` : ''}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5}>{audit.length ? 'No entries match these filters.' : 'No audit entries visible (audit-log.json not served).'}</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="small muted">The audit log is append-only and lives on the content branch; this view reads the same file the CLI writes.</p>

      <h2>Health (this device’s event buffer)</h2>
      <p className="small muted">Counts from this browser only. Bridge events are essential and always recorded; product events only with consent. A server-side view needs the cloud adapter and readers’ consent.</p>
      {tele && (
        <div className="tiles">
          {['bridge_ready', 'checkpoint_committed', 'progress_conflict_detected', 'bridge_invalid_message', 'bridge_hello_rejected', 'story_runtime_error'].map((k) => (
            <div key={k} className="tile"><b>{tele.byName[k] ?? 0}</b><span>{k.replace(/_/g, ' ')}</span></div>
          ))}
        </div>
      )}
    </div>
  )
}

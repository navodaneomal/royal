/* Operator console (§8, P0.7, P0.9): catalog and channels, release history
   with validation reports, audit log, telemetry health, and the four
   operator actions. Actions call the story host's dev admin API when it is
   reachable; on a static deployment they show the equivalent CLI command
   instead of pretending. */
import React, { useEffect, useState } from 'react'
import { catalog, storyUrl, STORY_BASE, isCrossOrigin } from '../lib/catalog'
import { telemetrySummary } from '../lib/telemetry'
import { useApp } from '../main'

export function OperatorView() {
  const { toast } = useApp()
  const [stories, setStories] = useState<any[]>([])
  const [audit, setAudit] = useState<any[]>([])
  const [tele, setTele] = useState<any>(null)
  const [token, setToken] = useState('dev-admin')
  const [adminUp, setAdminUp] = useState(false)

  async function load() {
    const { stories } = await catalog(true)
    setStories(stories)
    setTele(await telemetrySummary())
    try {
      const res = await fetch(storyUrl('audit-log.json'), { cache: 'no-store' })
      setAudit(res.ok ? (await res.json()).slice().reverse() : [])
    } catch { setAudit([]) }
  }
  useEffect(() => {
    load()
    // the admin API exists only on the dev story host, never on a static deploy
    fetch(STORY_BASE + '/admin/ping', { method: 'POST', headers: { 'x-admin-token': 'probe' } })
      .then((r) => setAdminUp(r.status === 401 || r.status === 400))
      .catch(() => setAdminUp(false))
  }, [])

  async function act(action: string, body: any, cli: string) {
    if (!adminUp) { toast('Static host — run: ' + cli); return }
    try {
      const res = await fetch(`${STORY_BASE}/admin/${action}`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify(body),
      })
      const out = await res.json()
      if (out.ok) { toast(`${action}: done`); load() }
      else toast(`${action} failed: ${(out.errors ?? []).join('; ')}`)
    } catch (e: any) { toast('admin API unreachable: ' + e.message) }
  }

  return (
    <main className="page">
      <h1>Operator</h1>
      <p className="lede">
        Immutable releases, channel pointers, audit trail, and the kill switch. Every action here is also a CLI
        command — the console is a window, not a second source of truth.
      </p>

      {!isCrossOrigin && (
        <p className="callout">
          Single-origin preview: stories run in <strong>opaque sandboxes</strong> and operator actions are CLI-only.
          Run <code className="mono">npm run dev</code> for the two-origin setup with the live admin API.
        </p>
      )}
      {adminUp && (
        <div className="setting">
          <label htmlFor="op-token">Admin token</label>
          <span className="hint">Dev default is <code className="mono">dev-admin</code>; set STORYFRAME_ADMIN_TOKEN on the host.</span>
          <select style={{ display: 'none' }} />
          <input id="op-token" style={{ maxWidth: '18rem', padding: '0.4rem 0.5rem', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--ink)' }}
            value={token} onChange={(e) => setToken(e.target.value)} />
        </div>
      )}

      <h2>Catalog and channels</h2>
      <div style={{ overflowX: 'auto' }}>
        <table className="op">
          <thead><tr><th>Story</th><th>Production</th><th>Releases</th><th>Actions</th></tr></thead>
          <tbody>
            {stories.map((s) => {
              const prod = s.channels?.production
              return (
                <tr key={s.storyId}>
                  <td><strong>{s.title}</strong><br /><code className="mono">{s.slug}</code></td>
                  <td>
                    <code className="mono">{prod?.releaseId ?? '—'}</code>
                    {prod?.disabled && <div><span className="badge bad">disabled</span></div>}
                  </td>
                  <td>
                    {s.releases.map((r: any) => (
                      <div key={r.releaseId} style={{ marginBottom: '0.3rem' }}>
                        <code className="mono">{r.releaseId}</code> v{r.version}
                        {r.validation?.warnings?.length ? <span className="badge warn" style={{ marginLeft: 6 }}>{r.validation.warnings.length} warn</span> : null}
                        {prod?.releaseId !== r.releaseId && (
                          <button className="btn secondary" style={{ padding: '0.1rem 0.5rem', marginLeft: 6, fontSize: '0.78rem' }}
                            onClick={() => act('promote', { slug: s.slug, releaseId: r.releaseId }, `npm run storyframe promote ${s.slug} ${r.releaseId}`)}>
                            promote
                          </button>
                        )}
                      </div>
                    ))}
                  </td>
                  <td>
                    <div className="btn-row" style={{ margin: 0 }}>
                      <button className="btn secondary" onClick={() => act('rollback', { slug: s.slug }, `npm run storyframe rollback ${s.slug}`)}>Rollback</button>
                      {prod?.disabled
                        ? <button className="btn secondary" onClick={() => act('enable', { slug: s.slug }, `npm run storyframe enable ${s.slug}`)}>Enable</button>
                        : <button className="btn danger" onClick={() => act('disable', { slug: s.slug }, `npm run storyframe disable ${s.slug}`)}>Disable</button>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <h2>Release health (this device's event buffer)</h2>
      {tele && (
        <div className="grid-cards">
          {['bridge_ready', 'checkpoint_committed', 'progress_conflict_detected', 'bridge_invalid_message', 'bridge_hello_rejected', 'story_runtime_error'].map((k) => (
            <div key={k} className="entry"><h3>{tele.byName[k] ?? 0}</h3><p className="meta">{k}</p></div>
          ))}
        </div>
      )}

      <h2>Audit log</h2>
      <div style={{ overflowX: 'auto' }}>
        <table className="op">
          <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Detail</th></tr></thead>
          <tbody>
            {audit.slice(0, 20).map((a, i) => (
              <tr key={i}>
                <td>{new Date(a.at).toLocaleString()}</td>
                <td>{a.actor}</td>
                <td><code className="mono">{a.action}</code></td>
                <td>{a.slug ?? ''} {a.releaseId ?? ''} {a.channel ? `→ ${a.channel}` : ''}{a.from ? ` (${a.from} → ${a.to})` : ''}</td>
              </tr>
            ))}
            {audit.length === 0 && <tr><td colSpan={4}>No audit entries visible (audit-log.json not served).</td></tr>}
          </tbody>
        </table>
      </div>

      <h2>Runbook</h2>
      <p className="callout">
        Broken release → <code className="mono">storyframe disable &lt;slug&gt;</code>, then
        <code className="mono"> storyframe rollback &lt;slug&gt;</code>. Files are never overwritten; evidence stays.
        Full procedures: <code className="mono">docs/incident-runbook.md</code>.
      </p>
    </main>
  )
}

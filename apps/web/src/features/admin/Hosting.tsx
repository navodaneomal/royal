/* Hosting centre (#/admin/hosting): where this library lives, whether the
   free GitHub Pages setup is complete, and a "Fix it for me" button that
   finishes it with the owner's OWN token — never ours, never stored beyond
   this page (the setup token is held in component state only).
   The rules are @storyframe/publishing → inspectHosting / fixHosting, the
   same code `npm run setup:pages` runs in a terminal. */
import React, { useEffect, useState } from 'react'
import { inspectHosting, fixHosting, tokenLinks, pagesUrl } from '@storyframe/publishing'
import { adminSession, setRepo } from '../../lib/admin'
import { QrCode } from '../../components/QrCode'
import { CheckIcon, GlobeIcon, LinkIcon } from '../../components/Icons'

type Step = { id: string; state: string; title: string; detail: string; fixable: boolean; needs: string | null }
const MARK: Record<string, string> = { done: '✓', todo: '!', working: '…', blocked: '✕', info: 'i' }

function githubApi(token: string) {
  return async (method: string, path: string, body?: unknown) => {
    const res = await fetch('https://api.github.com' + path, {
      method,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
    let data: any = null
    try { data = res.status === 204 ? null : await res.json() } catch { /* empty body */ }
    return { status: res.status, data }
  }
}

function whereAmI() {
  const h = location.hostname
  if ((window as any).Capacitor) return { kind: 'the Android app', note: 'This copy runs inside the Android app.' }
  if (/\.github\.io$/i.test(h)) return { kind: 'GitHub Pages', note: 'This copy is served by GitHub Pages.' }
  if (/\.pages\.dev$/i.test(h)) return { kind: 'Cloudflare Pages', note: 'This copy is served by Cloudflare Pages.' }
  if (/^(localhost|127\.0\.0\.1)$/.test(h)) return { kind: 'your computer', note: 'This copy runs on your computer (npm run dev / preview). Only you can see it — set up hosting below to put it online.' }
  return { kind: h, note: `This copy is served from ${h}.` }
}

export function Hosting() {
  const session = adminSession()
  const [repo, setRepoInput] = useState(session.repo ?? '')
  const [setupToken, setSetupToken] = useState('')
  const [report, setReport] = useState<any>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [live, setLive] = useState<Record<string, { state: string; detail: string }>>({})
  const token = setupToken || session.githubToken || ''
  const [owner, name] = repo.split('/')
  const links = owner && name ? tokenLinks({ owner, repo: name }) : null
  const site = report?.url ?? (owner && name ? pagesUrl(owner, name) : null)
  const here = whereAmI()

  async function check(quiet = false) {
    if (!token || !repo.includes('/')) return
    if (!quiet) { setBusy('Checking…'); setError('') }
    try {
      const r = await inspectHosting(githubApi(token), repo.trim())
      if (r.error) setError(r.error === 'bad-token' ? 'GitHub did not accept that token.' : r.error === 'not-found' ? `GitHub cannot find ${repo} with this token — check the name, and that the token includes this repository.` : r.error === 'repo-format' ? 'Write the repository as owner/name.' : `GitHub answered ${r.error}.`)
      setReport(r.error ? null : r)
    } catch (e: any) { setError('Could not reach GitHub: ' + e.message) }
    finally { if (!quiet) setBusy('') }
  }
  useEffect(() => { if (token && repo.includes('/')) check() }, [])
  // while a deployment runs, keep the checklist live
  useEffect(() => {
    if (!report?.steps?.some((s: Step) => s.state === 'working')) return
    const id = setInterval(() => check(true), 10000)
    return () => clearInterval(id)
  }, [report])

  async function fix() {
    if (!report) return
    setBusy('Setting up…'); setError(''); setLive({})
    try {
      await fixHosting(githubApi(token), report, (s: any) => setLive((l) => ({ ...l, [s.id]: { state: s.state, detail: s.detail } })))
      await check(true)
    } catch (e: any) { setError(e.message); await check(true) }
    finally { setBusy('') }
  }

  const steps: Step[] = report?.steps ?? []
  const fixable = steps.some((s) => s.fixable)
  const studioUrl = site ? site + '#/admin/connect' : null

  return (
    <div>
      <p className="callout info"><strong>Where this copy runs: {here.kind}.</strong> {here.note}</p>

      <section className="panel" aria-labelledby="host-h">
        <h2 id="host-h" style={{ marginTop: 0 }}>Free hosting on GitHub Pages</h2>
        <p>Your whole library — reader, books, and this Studio — online for $0, with only a GitHub account. Paste a <strong>one-day setup token</strong>, press <strong>Check</strong>, then <strong>Fix it for me</strong>. Nothing is deleted or rewritten: it creates <code className="mono">main</code> from your current code, makes it the default, switches Pages on, and starts the first deployment.</p>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="h-repo">Repository (owner/name)</label>
            <input id="h-repo" type="text" value={repo} onChange={(e) => setRepoInput(e.target.value)} onBlur={() => repo.includes('/') && setRepo(repo, session.branch)} placeholder="you/your-library" />
          </div>
          <div className="field">
            <label htmlFor="h-token">Setup token</label>
            <input id="h-token" type="password" autoComplete="off" spellCheck={false} value={setupToken} onChange={(e) => setSetupToken(e.target.value)} placeholder={session.githubToken ? 'using your Studio token (paste a setup token for full rights)' : 'github_pat_…'} />
            <span className="hint">Held only by this page — gone when you leave it. {links && <a href={links.setup} target="_blank" rel="noreferrer">Create one (pre-filled, expires in 1 day)</a>} — choose “Only select repositories” → {name || 'your repo'}.</span>
          </div>
        </div>
        <div className="btn-row">
          <button className="btn secondary" disabled={!token || !repo.includes('/') || !!busy} onClick={() => check()}>Check</button>
          <button className="btn accent" disabled={!report || !fixable || !!busy} onClick={fix} data-testid="host-fix"><CheckIcon /> Fix it for me</button>
          {busy && <span className="small muted" role="status">{busy}</span>}
        </div>
        {!token && <p className="small muted">No token yet — the checklist appears once you paste one.</p>}
        {error && <p className="callout bad" role="alert">{error}</p>}

        {steps.length > 0 && (
          <ol className="steps-live" aria-label="Hosting checklist" data-testid="host-steps">
            {steps.map((s) => {
              const l = live[s.id]
              const state = l ? (l.state === 'failed' ? 'blocked' : l.state) : s.state
              return (
                <li key={s.id} data-state={state}>
                  <span className="mark" aria-hidden="true">{MARK[state] ?? '·'}</span>
                  <span><strong>{s.title}</strong><p>{l?.detail ?? s.detail}</p>{state !== 'done' && s.needs && <p className="small muted">Token permission: {s.needs}</p>}</span>
                </li>
              )
            })}
          </ol>
        )}
        {report?.lastRun?.url && <p className="small"><a href={report.lastRun.url} target="_blank" rel="noreferrer">Open the latest deployment run</a></p>}
      </section>

      {site && (
        <section className="panel" aria-labelledby="links-h">
          <h2 id="links-h" style={{ marginTop: 0 }}>Your links {report?.ok ? <span className="badge good">live</span> : <span className="badge warn">after setup</span>}</h2>
          <div className="live-links">
            <a className="live-link" href={site} target="_blank" rel="noreferrer"><span>Reader app</span><code>{site}</code></a>
            <a className="live-link" href={studioUrl!} target="_blank" rel="noreferrer"><span>Studio (publish books)</span><code>{studioUrl}</code></a>
            <a className="live-link" href={site + '#/add'} target="_blank" rel="noreferrer"><span>Add a book (any reader)</span><code>{site}#/add</code></a>
            {report?.repo?.htmlUrl && <a className="live-link" href={report.repo.htmlUrl + '/actions'} target="_blank" rel="noreferrer"><span>Publishing runs</span><code>{report.repo.htmlUrl}/actions</code></a>}
            {links && <a className="live-link" href={links.publishing} target="_blank" rel="noreferrer"><span>Everyday publishing token</span><code>Contents + Actions, 90 days</code></a>}
          </div>
          <div className="qr">
            <QrCode text={site} label={`QR code that opens ${site}`} />
            <span className="small muted">Scan to open the library on a phone — then “Install” puts it on the home screen.</span>
          </div>
          {!report?.ok && <p className="small muted">GitHub Pages can take a minute or two after the first deployment before the address answers.</p>}
        </section>
      )}

      <section className="panel" aria-labelledby="alt-h">
        <h2 id="alt-h" style={{ marginTop: 0 }}><GlobeIcon /> Other ways to host</h2>
        <ul className="list">
          <li><span className="grow"><strong>Cloudflare Pages</strong><br /><span className="small muted">Separate origins and real security headers — DEPLOY.md, steps 1–15. Also free.</span></span></li>
          <li><span className="grow"><strong>Any static host</strong><br /><span className="small muted"><code className="mono">npm run build && npm run deploy:bundle -- --only pages</code> gives you a folder you can upload anywhere.</span></span></li>
          <li><span className="grow"><strong>From a terminal</strong><br /><span className="small muted"><code className="mono">GITHUB_TOKEN=… npm run setup:pages -- {repo || 'owner/name'} --fix</code> runs this same checklist.</span></span></li>
        </ul>
        <p className="small muted"><LinkIcon /> GitHub Pages is free for public repositories and is not meant for commercial sites — a library that sells books should use Cloudflare.</p>
      </section>
    </div>
  )
}

/* Connect the Admin Studio to GitHub (or the local dev host). The token is
   held in sessionStorage for this tab only — see lib/admin.ts. */
import React, { useEffect, useState } from 'react'
import { adminSession, setGithubToken, setRepo, setDevToken, signOutAdmin, probeDevAdmin } from '../../lib/admin'
import { GitHub } from '../../lib/github'
import { configInfo } from '../../lib/config'

export function Connect() {
  const s = adminSession()
  const [repo, setRepoInput] = useState(s.repo)
  const [branch, setBranch] = useState(s.branch)
  const [token, setToken] = useState('')
  const [status, setStatus] = useState<string>(s.githubToken ? 'A token is set for this tab.' : '')
  const [dev, setDev] = useState<boolean | null>(null)
  useEffect(() => { probeDevAdmin().then(setDev) }, [])

  async function test(t = s.githubToken) {
    if (!t || !repo) return
    setStatus('Checking…')
    try {
      const r = await new GitHub(t, repo).check()
      setStatus(r.push ? `✓ Connected to ${r.fullName} (${r.private ? 'private' : 'public'}) with write access. Default branch: ${r.defaultBranch}.` : `Connected to ${r.fullName}, but this token cannot write to it — give it Contents: read & write.`)
    } catch (e: any) { setStatus('✗ ' + e.message) }
  }

  return (
    <div>
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>GitHub (production)</h2>
        <p className="small">Publishing commits your book to <code className="mono">stories/&lt;slug&gt;/</code>; operator buttons start the <code className="mono">publish</code> workflow. Create a <strong>fine-grained personal access token</strong> for this repository only, with <strong>Contents: Read and write</strong> and <strong>Actions: Read and write</strong> (DEPLOY.md, step 4).</p>
        <form onSubmit={async (e) => { e.preventDefault(); setRepo(repo, branch); if (token) { setGithubToken(token); setToken(''); await test(token) } }}>
          <div className="form-grid">
            <div className="field"><label htmlFor="c-repo">Repository (owner/name)</label>
              <input id="c-repo" type="text" value={repo} disabled={s.repoFromConfig} onChange={(e) => setRepoInput(e.target.value)} placeholder="you/storyframe" />
              {s.repoFromConfig && <span className="hint">Set by config.json.</span>}</div>
            <div className="field"><label htmlFor="c-branch">Source branch</label>
              <input id="c-branch" type="text" value={branch} onChange={(e) => setBranch(e.target.value)} /></div>
          </div>
          <div className="field"><label htmlFor="c-token">Fine-grained token</label>
            <input id="c-token" type="password" autoComplete="off" spellCheck={false} value={token} onChange={(e) => setToken(e.target.value)} placeholder={s.githubToken ? '•••••••• (set for this tab)' : 'github_pat_…'} />
            <span className="hint">Kept in this tab’s sessionStorage only — closing the tab forgets it. Never stored in IndexedDB or config.json, never sent to a story frame.</span></div>
          <div className="btn-row">
            <button className="btn">Save</button>
            {s.githubToken && <button type="button" className="btn secondary" onClick={() => test()}>Test connection</button>}
            {(s.githubToken || s.devToken) && <button type="button" className="btn danger" onClick={() => { signOutAdmin(); setStatus('Signed out of the Admin Studio in this tab.') }}>Forget token</button>}
          </div>
        </form>
        {status && <p className="small" role="status">{status}</p>}
      </div>
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Local development</h2>
        {dev ? (
          <>
            <p className="small">The dev story host’s admin API is reachable (<code className="mono">npm run dev</code>). Operator buttons act on your local content plane immediately.</p>
            <div className="btn-row"><button className="btn secondary" onClick={() => setDevToken(prompt('Dev admin token (default: dev-admin)') ?? 'dev-admin')}>Use the dev admin API in this tab</button></div>
          </>
        ) : <p className="small muted">No dev admin API here — that is expected on a static deployment.</p>}
      </div>
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>This deployment</h2>
        <ul className="small">
          <li>Story origin: <code className="mono">{configInfo().config.storyOrigin}</code> (from {configInfo().source})</li>
          <li>Cloud sync: {configInfo().config.supabaseUrl ? 'configured' : 'off'}</li>
          {configInfo().warnings.map((w, i) => <li key={i} className="err">{w}</li>)}
        </ul>
        <p className="small muted">Optional hardening: put Cloudflare Access (free for up to 50 users) in front of the app so only you can even load the Admin Studio — DEPLOY.md §Hardening.</p>
      </div>
    </div>
  )
}

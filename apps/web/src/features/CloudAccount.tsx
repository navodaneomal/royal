/* Settings → Account when this library has cloud sync configured. Magic
   link only (no passwords to leak); guest progress is imported and merged,
   never overwritten. Honest about what is and is not synced. */
import React, { useEffect, useState } from 'react'
import { useApp } from '../context'
import { currentUser, sendMagicLink, signOut, upgradeGuest } from '../lib/cloud'
import { getKv } from '../lib/store'

export function CloudAccount() {
  const { toast } = useApp()
  const [user, setUser] = useState<any>(undefined)
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [upgradedAt, setUpgradedAt] = useState<string | null>(null)

  useEffect(() => {
    currentUser().then(setUser).catch(() => setUser(null))
    getKv('cloud.upgradedAt', null).then(setUpgradedAt)
  }, [])

  if (user === undefined) return <p className="small muted">Checking your account…</p>
  if (!user) {
    return (
      <form className="panel" onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        try { await sendMagicLink(email); setSent(true) } catch (err: any) { toast('Could not send the link: ' + err.message) } finally { setBusy(false) }
      }}>
        <p style={{ marginTop: 0 }}>Sign in to keep your progress on every device. We email you a one-time link — no password.</p>
        <div className="field">
          <label htmlFor="cloud-email">Email</label>
          <input id="cloud-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <button className="btn" disabled={busy || sent}>{sent ? 'Link sent — check your inbox' : 'Email me a sign-in link'}</button>
        <p className="small muted">Until you sign in, you are a guest and progress stays on this device. Signing in imports it; nothing is overwritten.</p>
      </form>
    )
  }
  return (
    <div className="panel">
      <p style={{ marginTop: 0 }}>Signed in as <strong>{user.email}</strong>.</p>
      <p className="small">{upgradedAt ? `This device’s progress was imported ${new Date(upgradedAt).toLocaleString()}.` : 'This device’s guest progress has not been imported yet.'}</p>
      <div className="btn-row">
        <button className="btn" disabled={busy} onClick={async () => {
          setBusy(true)
          try { const r = await upgradeGuest(toast); toast(`Synced ${r.done} ${r.done === 1 ? 'story' : 'stories'}`); setUpgradedAt(new Date().toISOString()) }
          catch (err: any) { toast('Sync failed: ' + err.message) } finally { setBusy(false) }
        }}>{upgradedAt ? 'Sync now' : 'Import this device’s progress'}</button>
        <button className="btn secondary" onClick={async () => { await signOut(); setUser(null) }}>Sign out</button>
      </div>
      <p className="small muted">Free Supabase projects pause after a week without traffic; if sync stops, the library’s operator can resume it. Your progress on this device is never affected.</p>
    </div>
  )
}

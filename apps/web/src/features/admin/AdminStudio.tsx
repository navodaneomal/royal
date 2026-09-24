/* The Admin Studio (#/admin) — lazy-loaded so readers never download it.
   Routes: #/admin · #/admin/new[/draftId] · #/admin/book/<slug> · #/admin/connect
   Hidden from the main navigation until a token is present; reachable by
   URL so an operator can connect in the first place. */
import React from 'react'
import { Dashboard } from './Dashboard'
import { Wizard, WizardHome } from './Wizard'
import { BookReleases } from './BookReleases'
import { Connect } from './Connect'

export default function AdminStudio({ parts }: { parts: string[] }) {
  const [section = '', arg] = parts
  const tabs: [string, string][] = [['', 'Dashboard'], ['new', 'New book'], ['connect', 'Connection']]
  const title = section === 'new' ? 'New book' : section === 'book' ? 'Release management' : section === 'connect' ? 'Connection' : 'Admin Studio'
  return (
    <main className="page admin">
      <div className="admin-head">
        <div>
          <p className="small muted" style={{ margin: 0 }}>Admin Studio</p>
          <h1>{title}</h1>
        </div>
      </div>
      <nav className="subnav" aria-label="Admin">
        {tabs.map(([k, label]) => <a key={k} href={`#/admin${k ? '/' + k : ''}`} aria-current={section === k ? 'page' : undefined}>{label}</a>)}
        {section === 'book' && <a href={`#/admin/book/${arg}`} aria-current="page">{arg}</a>}
      </nav>
      {section === '' && <Dashboard />}
      {section === 'new' && (arg ? <Wizard draftId={arg} /> : <WizardHome />)}
      {section === 'book' && arg && <BookReleases slug={arg} />}
      {section === 'connect' && <Connect />}
    </main>
  )
}

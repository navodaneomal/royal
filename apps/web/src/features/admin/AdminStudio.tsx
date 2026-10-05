/* The Studio (#/admin) — lazy-loaded so readers never download it.
   Routes: #/admin · #/admin/publish · #/admin/new[/draftId] · #/admin/book/<slug>
           #/admin/hosting · #/admin/connect
   Hidden from the main navigation until a token is present; reachable by
   URL so an operator can connect in the first place. */
import React, { Suspense, lazy } from 'react'
import { Dashboard } from './Dashboard'
import { Wizard, WizardHome } from './Wizard'
import { BookReleases } from './BookReleases'
import { Connect } from './Connect'
import { Hosting } from './Hosting'
import { adminSession } from '../../lib/admin'
import { PenIcon, TemplateIcon, GlobeIcon, LinkIcon } from '../../components/Icons'

const Composer = lazy(() => import('../compose/Composer'))

function StudioHome() {
  const s = adminSession()
  const connected = !!(s.githubToken && s.repo)
  return (
    <>
      <div className="action-cards">
        <a className="action-card primary" href="#/admin/publish">
          <span className="ic"><PenIcon /></span>
          <strong>Publish a book</strong>
          <span>One screen: drop a .md, .docx, or .txt (or write one), check it, preview it, publish it.</span>
        </a>
        <a className="action-card primary" href="#/admin/link">
          <span className="ic"><GlobeIcon /></span>
          <strong>Link a book</strong>
          <span>Already hosted somewhere? Paste the link, add a cover — readers tap it and the book opens. One link or a whole list.</span>
        </a>
        <a className="action-card" href="#/admin/new">
          <span className="ic"><TemplateIcon /></span>
          <strong>Advanced wizard</strong>
          <span>Every manifest field, crafted and prebuilt packages, the cover studio, the full accessibility checklist.</span>
        </a>
        <a className="action-card" href="#/admin/hosting">
          <span className="ic"><GlobeIcon /></span>
          <strong>Hosting</strong>
          <span>Put the library online free on GitHub Pages — a live checklist and a one-click fix.</span>
        </a>
        <a className="action-card" href="#/admin/connect">
          <span className="ic"><LinkIcon /></span>
          <strong>{connected ? 'Connected' : 'Connect GitHub'}</strong>
          <span>{connected ? `Publishing to ${s.repo} (${s.branch}).` : 'Paste a token once per tab to publish and run workflows.'}</span>
        </a>
      </div>
      <Dashboard />
    </>
  )
}

export default function AdminStudio({ parts }: { parts: string[] }) {
  const [section = '', arg] = parts
  if (section === 'publish' || section === 'link') {
    return <Suspense fallback={<main className="page"><h1>Publish a book</h1></main>}><Composer mode="studio" start={section === 'link' ? 'link' : 'make'} /></Suspense>
  }
  const tabs: [string, string][] = [['', 'Home'], ['publish', 'Publish'], ['new', 'Advanced'], ['hosting', 'Hosting'], ['connect', 'Connection']]
  const title = section === 'new' ? 'New book' : section === 'book' ? 'Release management' : section === 'connect' ? 'Connection' : section === 'hosting' ? 'Hosting' : 'Studio'
  return (
    <main className="page admin">
      <div className="admin-head">
        <div>
          <p className="eyebrow">Studio</p>
          <h1>{title}</h1>
        </div>
      </div>
      <nav className="subnav" aria-label="Studio">
        {tabs.map(([k, label]) => <a key={k} href={`#/admin${k ? '/' + k : ''}`} aria-current={section === k ? 'page' : undefined}>{label}</a>)}
        {section === 'book' && <a href={`#/admin/book/${arg}`} aria-current="page">{arg}</a>}
      </nav>
      {section === '' && <StudioHome />}
      {section === 'new' && (arg ? <Wizard draftId={arg} /> : <WizardHome />)}
      {section === 'book' && arg && <BookReleases slug={arg} />}
      {section === 'hosting' && <Hosting />}
      {section === 'connect' && <Connect />}
    </main>
  )
}

/* Link a book hosted elsewhere (ADR-0014).
     #/add/link            any reader: put a link on your own shelf (this device)
     #/admin/link          the Studio: publish the card for every reader
   Paste an address → it is recognised (Google Drive/Docs, YouTube, Vimeo,
   flipbook hosts, PDFs, Dropbox…), share links become their embeddable form,
   and a card with a cover appears. One link, or a whole list in one commit. */
import React, { useMemo, useState } from 'react'
import { composeLinkedBook, parseLinkList, LINK_KINDS, formatBytes } from '@storyframe/publishing'
import { useApp } from '../../context'
import { t } from '../../lib/i18n'
import { navigate } from '../../lib/router'
import { linkFor } from '../../lib/linked'
import { gh, type OpUpdate } from '../admin/ops'
import { mapToZip, downloadBytes } from '../admin/zip'
import { keepLinkedHere, publishForEveryone, coverUriOf } from './shelve'
import { CheckIcon, GlobeIcon, LinkIcon, PlusIcon, DownloadIcon } from '../../components/Icons'

type Mode = 'reader' | 'studio'

export function LinkBook({ mode }: { mode: Mode }) {
  const { toast, stories, refreshCatalog } = useApp()
  const [tab, setTab] = useState<'one' | 'many'>('one')
  const [f, setF] = useState({ url: '', title: '', author: '', tagline: '', synopsis: '', kind: '', open: '', rating: 'everyone', warnings: '', target: '' })
  const [coverFile, setCoverFile] = useState<{ name: string; bytes: Uint8Array } | null>(null)
  const [storyId] = useState(() => crypto.randomUUID())
  const [list, setList] = useState('')
  const [busy, setBusy] = useState(false)
  const [goLive, setGoLive] = useState(true)
  const [log, setLog] = useState<string[]>([])
  const [run, setRun] = useState<OpUpdate | null>(null)
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }))
  const client = mode === 'studio' ? gh() : null
  const published = useMemo(() => (stories ?? []).filter((s) => !s.local), [stories])
  const linkedPublished = published.filter((s) => linkFor(s))
  const target = f.target ? linkedPublished.find((s) => s.storyId === f.target) ?? null : null

  const composed = useMemo(() => {
    if (!f.url.trim()) return null
    return composeLinkedBook({
      url: f.url, title: f.title || undefined, author: f.author || undefined, tagline: f.tagline || undefined, synopsis: f.synopsis || undefined,
      kind: (f.kind || undefined) as any, open: mode === 'reader' ? 'tab' : ((f.open || undefined) as any), rating: f.rating,
      warnings: f.warnings ? f.warnings.split(',').map((w) => w.trim()).filter(Boolean) : [],
      storyId, coverFile: coverFile ?? undefined,
      existing: target ? { storyId: target.storyId, slug: target.slug, version: target.releases.at(-1)?.version ?? '1.0.0' } : undefined,
    })
  }, [f, coverFile, storyId, target?.storyId])

  const parsed = useMemo(() => (tab === 'many' ? parseLinkList(list) : { books: [], errors: [] }), [list, tab])
  const many = useMemo(() => parsed.books.map((b) => composeLinkedBook({ url: b.url, title: b.title, author: b.author, open: mode === 'reader' ? 'tab' : undefined })), [parsed, mode])
  const clashes = (slug: string) => published.some((s) => s.slug === slug)

  async function keep(list: any[]) {
    setBusy(true)
    try {
      for (const c of list) {
        const clash = clashes(c.summary.slug)
        const book = clash ? composeLinkedBook({ ...c.summary, url: c.summary.url, title: c.summary.title, author: c.summary.author || undefined, slug: c.summary.slug + '-mine', open: 'tab', coverFile: coverFile && list.length === 1 ? coverFile : undefined }) : c
        await keepLinkedHere(book)
      }
      await refreshCatalog()
      toast(list.length === 1 ? t('link.kept', { title: list[0].summary.title }) : t('link.keptMany', { n: list.length }))
      navigate('/')
    } catch (e: any) { toast(t('compose.saveFailed', { error: e.message })) } finally { setBusy(false) }
  }

  async function publish(list: any[]) {
    setBusy(true); setLog([]); setRun(null)
    try {
      await publishForEveryone(list.map((c) => ({ slug: c.summary.slug, version: c.summary.version, storyId: c.summary.storyId, releaseId: c.summary.releaseId, title: c.summary.title, source: c.source })),
        { goLive, say: (m) => setLog((l) => [...l, m]), onRun: setRun, refreshCatalog })
    } catch (e: any) { setLog((l) => [...l, '✗ ' + e.message]) } finally { setBusy(false) }
  }

  const s = composed?.summary
  const ok = !!composed?.ok
  const coverSrc = composed?.manifest ? coverUriOf(composed) : null
  const okMany = many.filter((c) => c.ok)

  return (
    <div className="composer">
      <div style={{ minWidth: 0 }}>
        <div className="pill-tabs" role="tablist" aria-label={t('link.tabs')}>
          <button role="tab" id="ltab-one" aria-selected={tab === 'one'} aria-controls="lpanel-one" onClick={() => setTab('one')}><LinkIcon /> {t('link.tab.one')}</button>
          <button role="tab" id="ltab-many" aria-selected={tab === 'many'} aria-controls="lpanel-many" onClick={() => setTab('many')}><PlusIcon /> {t('link.tab.many')}</button>
        </div>

        {tab === 'one' && (
          <section className="panel" role="tabpanel" id="lpanel-one" aria-labelledby="ltab-one">
            <div className="field">
              <label htmlFor="link-url">{t('link.url')}</label>
              <input id="link-url" type="url" inputMode="url" autoComplete="off" spellCheck={false} value={f.url} placeholder="https://…" onChange={(e) => set({ url: e.target.value })} data-testid="link-url" />
              <span className="hint">{s?.note || t('link.urlHint')}</span>
              {composed && !composed.link.ok && <span className="err" role="alert">{(composed.link as any).error}</span>}
            </div>
            {mode === 'studio' && linkedPublished.length > 0 && (
              <div className="field">
                <label htmlFor="link-target">{t('compose.target')}</label>
                <select id="link-target" value={f.target} onChange={(e) => set({ target: e.target.value })}>
                  <option value="">{t('compose.targetNew')}</option>
                  {linkedPublished.map((p) => <option key={p.storyId} value={p.storyId}>{t('compose.targetUpdate', { title: p.title })}</option>)}
                </select>
              </div>
            )}
            <div className="form-grid">
              <div className="field"><label htmlFor="link-title">{t('compose.bookTitle')}</label>
                <input id="link-title" type="text" value={f.title} placeholder={s?.title ?? ''} onChange={(e) => set({ title: e.target.value })} data-testid="link-title" /></div>
              <div className="field"><label htmlFor="link-author">{t('link.author')}</label>
                <input id="link-author" type="text" value={f.author} onChange={(e) => set({ author: e.target.value })} /></div>
              <div className="field"><label htmlFor="link-tagline">{t('compose.tagline')}</label>
                <input id="link-tagline" type="text" value={f.tagline} placeholder={s?.tagline ?? ''} onChange={(e) => set({ tagline: e.target.value })} /></div>
              <div className="field"><label htmlFor="link-kind">{t('link.kind')}</label>
                <select id="link-kind" value={f.kind || s?.kind || 'web'} onChange={(e) => set({ kind: e.target.value })}>
                  {LINK_KINDS.map((k: string) => <option key={k} value={k}>{t('linked.kind.' + k)}</option>)}
                </select></div>
              <div className="field"><label htmlFor="link-rating">{t('compose.rating')}</label>
                <select id="link-rating" value={f.rating} onChange={(e) => set({ rating: e.target.value })}>
                  {['everyone', 'teen', 'mature'].map((r) => <option key={r} value={r}>{t('rating.' + r)}</option>)}
                </select></div>
              <div className="field"><label htmlFor="link-warnings">{t('compose.warnings')}</label>
                <input id="link-warnings" type="text" value={f.warnings} placeholder={t('compose.warningsPlaceholder')} onChange={(e) => set({ warnings: e.target.value })} /></div>
            </div>
            <div className="field"><label htmlFor="link-synopsis">{t('link.synopsis')}</label>
              <textarea id="link-synopsis" value={f.synopsis} onChange={(e) => set({ synopsis: e.target.value })} style={{ minHeight: '5rem' }} /></div>

            {mode === 'studio' && (
              <fieldset className="field" style={{ border: 0, padding: 0 }}>
                <legend className="label" style={{ fontWeight: 600, fontSize: '0.9rem' }}>{t('link.openLegend')}</legend>
                <label className="switch"><input type="radio" name="open" checked={(f.open || s?.open || 'tab') === 'tab'} onChange={() => set({ open: 'tab' })} /> {t('link.openTab')}</label>
                <label className="switch"><input type="radio" name="open" checked={(f.open || s?.open) === 'embed'} onChange={() => set({ open: 'embed' })} /> {t('link.openEmbed')}</label>
                <span className="hint">{s?.embeddable ? t('link.embedGood') : t('link.embedHint')}</span>
              </fieldset>
            )}

            <div className="field">
              <label htmlFor="link-cover">{t('link.cover')}</label>
              <input id="link-cover" type="file" accept=".png,.jpg,.jpeg,.webp,.svg" onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                if (file.size > 2 * 1024 * 1024) { toast(t('link.coverTooBig')); return }
                setCoverFile({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) })
              }} />
              <span className="hint">{coverFile ? <>{coverFile.name} · <button type="button" className="link-btn" onClick={() => setCoverFile(null)}>{t('link.coverGenerated')}</button></> : t('link.coverHint')}</span>
            </div>
          </section>
        )}

        {tab === 'many' && (
          <section className="panel" role="tabpanel" id="lpanel-many" aria-labelledby="ltab-many">
            <div className="field">
              <label htmlFor="link-list">{t('link.listLabel')}</label>
              <textarea id="link-list" className="editor" style={{ minHeight: '14rem' }} value={list} spellCheck={false} onChange={(e) => setList(e.target.value)}
                placeholder={'The Lantern Fox | https://example.com/fox.pdf\nSmall Hours — Ada Byron | https://heyzine.com/flip-book/abc.html\nhttps://drive.google.com/file/d/…/view'} data-testid="link-list" />
              <span className="hint">{t('link.listHint')}</span>
            </div>
            {parsed.errors.length > 0 && <ul className="issues">{parsed.errors.slice(0, 6).map((e, i) => <li key={i} className="error">{e}</li>)}</ul>}
            {many.length > 0 && (
              <div className="table-wrap">
                <table className="op">
                  <thead><tr><th>{t('compose.bookTitle')}</th><th>{t('link.kind')}</th><th>{t('link.where')}</th><th>{t('link.check')}</th></tr></thead>
                  <tbody>
                    {many.map((c, i) => (
                      <tr key={i}>
                        <td>{c.summary.title}{c.summary.author ? <span className="small muted"> · {c.summary.author}</span> : null}</td>
                        <td>{t('linked.kind.' + c.summary.kind)}</td>
                        <td><code className="mono">{c.summary.host}</code> · {c.summary.open === 'embed' ? t('link.inApp') : t('link.newTab')}</td>
                        <td>{c.ok ? <span className="badge good">✓</span> : <span className="badge bad">{c.issues[0]?.items[0]}</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>

      <aside className="composer-side" aria-label={t('compose.status')}>
        {tab === 'one' ? (
          <div className="status-card">
            {coverSrc ? <img className="cover-preview" src={coverSrc} alt={t('compose.coverAlt', { title: s?.title ?? '' })} /> : <div className="cover-preview" aria-hidden="true" />}
            <h2>{s?.title || t('link.emptyTitle')}</h2>
            {!composed && <p className="small muted">{t('link.emptyBody')}</p>}
            {composed && (
              <>
                <p className={`verdict ${ok ? 'good' : 'bad'}`} role="status" data-testid="link-verdict">{ok ? <><CheckIcon /> {t('link.ready')}</> : t('compose.notReady', { n: composed.issues.reduce((n: number, g: any) => n + g.items.length, 0) })}</p>
                {ok && (
                  <ul className="facts-mini">
                    <li><b>{t('linked.kind.' + s!.kind)}</b> · {s!.host} · {s!.open === 'embed' ? t('link.inApp') : t('link.newTab')}</li>
                    <li>v{s!.version} · <code className="mono">{s!.slug}</code> · {formatBytes(s!.totalBytes)}</li>
                  </ul>
                )}
                {!ok && <ul className="issues">{composed.issues.slice(0, 3).map((g: any) => <li key={g.code} className="error">{g.items[0]}<p className="fix">{g.fix}</p></li>)}</ul>}
              </>
            )}
            <div className="btn-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              {mode === 'studio' && (client
                ? <button className="btn accent big" disabled={!ok || busy} onClick={() => publish([composed])}><GlobeIcon /> {busy ? t('compose.publishing') : t('compose.publish')}</button>
                : <a className="btn accent big" href="#/admin/connect"><GlobeIcon /> {t('compose.connectToPublish')}</a>)}
              {mode === 'studio' && client && <label className="switch small"><input type="checkbox" checked={goLive} onChange={(e) => setGoLive(e.target.checked)} /> {t('compose.goLive')}</label>}
              <button className={`btn ${mode === 'reader' ? 'big' : 'secondary'}`} disabled={!ok || busy} onClick={() => keep([composed])} data-testid="link-keep"><PlusIcon /> {t('link.keep')}</button>
              {ok && <a className="btn secondary" href={s!.url} target="_blank" rel="noopener noreferrer">{t('link.test')} ↗<span className="sr"> {t('linked.newTab')}</span></a>}
              {mode === 'studio' && <button className="btn ghost" disabled={!ok} onClick={() => composed && downloadBytes(mapToZip(composed.source, s!.slug), `${s!.slug}.zip`)}><DownloadIcon /> {t('link.download')}</button>}
            </div>
            <p className="small muted" style={{ margin: 0 }}>{mode === 'reader' ? t('link.privateNote') : t('link.studioNote')}</p>
          </div>
        ) : (
          <div className="status-card">
            <h2>{t('link.manyTitle', { n: okMany.length })}</h2>
            <p className="small muted">{many.length ? t('link.manyBody', { ok: okMany.length, total: many.length }) : t('link.manyEmpty')}</p>
            <div className="btn-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              {mode === 'studio' && (client
                ? <button className="btn accent big" disabled={!okMany.length || busy} onClick={() => publish(okMany)}><GlobeIcon /> {t('link.publishMany', { n: okMany.length })}</button>
                : <a className="btn accent big" href="#/admin/connect"><GlobeIcon /> {t('compose.connectToPublish')}</a>)}
              {mode === 'studio' && client && <label className="switch small"><input type="checkbox" checked={goLive} onChange={(e) => setGoLive(e.target.checked)} /> {t('compose.goLive')}</label>}
              <button className={`btn ${mode === 'reader' ? 'big' : 'secondary'}`} disabled={!okMany.length || busy} onClick={() => keep(okMany)} data-testid="link-keep-many"><PlusIcon /> {t('link.keepMany', { n: okMany.length })}</button>
            </div>
          </div>
        )}

        {(log.length > 0 || run) && (
          <div className="panel" aria-live="polite">
            <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>{t('compose.progress')}</h2>
            <ol className="small">{log.map((l, i) => <li key={i}>{l}</li>)}</ol>
            {run && <p className="small"><span className={`status-dot ${run.phase === 'completed' || run.phase === 'done' ? (run.conclusion && run.conclusion !== 'success' ? 'bad' : 'good') : run.phase === 'error' ? 'bad' : 'run'}`} />CI: {run.phase}{run.conclusion ? ` · ${run.conclusion}` : ''} {run.url && <a href={run.url} target="_blank" rel="noreferrer">{t('compose.openRun')}</a>}</p>}
          </div>
        )}
      </aside>
    </div>
  )
}

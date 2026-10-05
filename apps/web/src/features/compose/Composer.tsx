/* The one-screen book workshop.
     #/add                 any reader: write, paste, or drop a book → read it on this device
     #/admin/publish       the Studio: the same, plus "Publish for everyone"
   Drop a .md, .txt, or .docx (or pick a starter), and everything else is filled
   in: title, slug, version, cover, accessibility, chapter ids. The release
   gate, the release id, and the package are the SAME code CI runs
   (@storyframe/publishing → composeQuickBook). A book kept on this device
   plays from a hashed Blob in the opaque sandbox, exactly like an offline
   download (ADR-0003). The 8-step wizard stays as "Advanced". */
import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import sdkText from '@storyframe/sdk/dist/storyframe-sdk.iife.js?raw'
import {
  composeQuickBook, stampComposed, textToQuickBookMarkdown, htmlToQuickBookMarkdown, STARTER_BOOKS,
  applyPublish, emptyRegistry, sha256Hex, toText, formatBytes, extOf, COVER_PALETTES, THEME_NAMES,
} from '@storyframe/publishing'
import { useApp } from '../../context'
import { t } from '../../lib/i18n'
import { navigate } from '../../lib/router'
import { getKv, setKv, saveDownload, removeDownload } from '../../lib/store'
import { putLocalBook, listLocalBooks } from '../../lib/localBooks'
import { releaseFor, type CatalogStory } from '../../lib/catalog'
import { adminSession } from '../../lib/admin'
import { mapToZip, downloadBytes } from '../admin/zip'
import { gh, watchRun, runOp, type OpUpdate } from '../admin/ops'
import { Preview } from '../admin/Preview'
import { LinkBook } from './LinkBook'
import { UploadIcon, PenIcon, TemplateIcon, PlayIcon, DownloadIcon, CheckIcon, GlobeIcon } from '../../components/Icons'

type Mode = 'reader' | 'studio'
type Tab = 'upload' | 'write' | 'templates'
type Draft = { markdown: string; theme: string; title: string; tagline: string; rating: string; warnings: string; storyId: string; target: string; updatedAt: string }

const THEME_LOOK: Record<string, { bg: string; ink: string; font: string }> = {
  manuscript: { bg: COVER_PALETTES.manuscript.bg, ink: COVER_PALETTES.manuscript.ink, font: 'var(--serif)' },
  terminal: { bg: COVER_PALETTES.terminal.bg, ink: COVER_PALETTES.terminal.ink, font: 'var(--mono)' },
  watercolor: { bg: COVER_PALETTES.watercolor.bg, ink: COVER_PALETTES.watercolor.ink, font: 'var(--serif)' },
  noir: { bg: COVER_PALETTES.noir.bg, ink: COVER_PALETTES.noir.ink, font: 'var(--sans)' },
  minimal: { bg: COVER_PALETTES.minimal.bg, ink: COVER_PALETTES.minimal.ink, font: 'var(--sans)' },
}
const SNIPPETS: [string, string][] = [
  ['compose.snip.chapter', '\n## New chapter\n\n'],
  ['compose.snip.secret', '\n:::secret{id="hidden-thing" name="A hidden thing" alt="Describe it for someone who cannot see it" hint="Something catches your eye"}\nWhat curious readers find.\n:::\n'],
  ['compose.snip.choice', '\n:::choice{id="the-choice" label="What do you do?"}\n- left: Take the left path\n- right: Take the right path\n:::\n\n:::branch{choice="the-choice" option="left"}\nOnly readers who went left see this.\n:::\n\n:::branch{choice="the-choice" option="right"}\nOnly readers who went right see this.\n:::\n'],
  ['compose.snip.ending', '\n:::ending{id="the-end" name="The End"}\nHow this way through the story ends.\n:::\n'],
  ['compose.snip.achievement', '\n::achievement{id="well-done" name="Well done" description="What the reader did."}\n'],
  ['compose.snip.break', '\n---\n'],
]
const emptyDraft = (): Draft => ({ markdown: '', theme: 'manuscript', title: '', tagline: '', rating: 'everyone', warnings: '', storyId: crypto.randomUUID(), target: '', updatedAt: new Date().toISOString() })
const svgUri = (svg: string) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)

export default function Composer({ mode, start = 'make' }: { mode: Mode; start?: 'make' | 'link' }) {
  const [kind, setKind] = useState<'make' | 'link'>(start)
  useEffect(() => setKind(start), [start])
  const { toast, stories, refreshCatalog, admin } = useApp()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [tab, setTab] = useState<Tab>('templates')
  const [assets, setAssets] = useState<Map<string, Uint8Array>>(new Map())
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState('')
  const [preview, setPreview] = useState(false)
  const [goLive, setGoLive] = useState(true)
  const [log, setLog] = useState<string[]>([])
  const [run, setRun] = useState<OpUpdate | null>(null)
  const [publishing, setPublishing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const KEY = `composer:${mode}`

  useEffect(() => {
    getKv<Draft | null>(KEY, null).then((d) => {
      const next = d && typeof d.markdown === 'string' ? { ...emptyDraft(), ...d } : emptyDraft()
      setDraft(next)
      setTab(next.markdown ? 'write' : 'templates')
    })
  }, [mode])
  // autosave — a closed tab never loses a book
  useEffect(() => { if (draft) { const id = setTimeout(() => setKv(KEY, draft), 500); return () => clearTimeout(id) } }, [draft])

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...(d ?? emptyDraft()), ...patch, updatedAt: new Date().toISOString() }))
  const published = useMemo(() => (stories ?? []).filter((s) => !s.local), [stories])
  const target: CatalogStory | null = mode === 'studio' && draft?.target ? published.find((s) => s.storyId === draft.target) ?? null : null
  const targetRelease = target ? releaseFor(target, 'beta') ?? releaseFor(target) : null

  const md = useDeferredValue(draft?.markdown ?? '')
  const composed = useMemo(() => {
    if (!draft || !md.trim()) return null
    return composeQuickBook({
      markdown: md, sdk: sdkText, theme: draft.theme, title: draft.title || undefined, tagline: draft.tagline || undefined,
      rating: draft.rating, warnings: draft.warnings ? draft.warnings.split(',').map((w) => w.trim()).filter(Boolean) : undefined,
      storyId: draft.storyId, assets,
      existing: target ? { storyId: target.storyId, slug: target.slug, version: targetRelease?.version ?? '1.0.0' } : undefined,
    })
  }, [md, draft?.theme, draft?.title, draft?.tagline, draft?.rating, draft?.warnings, draft?.storyId, assets, target?.storyId])

  if (!draft) return <main className="page"><h1>{t('compose.title')}</h1></main>

  /* ── import ──────────────────────────────────────────────────────── */
  async function ingest(list: FileList | File[]) {
    const nextAssets = new Map(assets)
    let text: string | null = null
    const notes: string[] = []
    for (const file of Array.from(list)) {
      const ext = extOf(file.name)
      const bytes = new Uint8Array(await file.arrayBuffer())
      if (ext === 'md' || ext === 'markdown') text = toText(bytes)
      else if (ext === 'txt') { const r = textToQuickBookMarkdown(toText(bytes)); text = r.markdown; notes.push(t('compose.note.txt', { n: r.chapters })) }
      else if (ext === 'docx') {
        setBusy(t('compose.converting'))
        const mod: any = await import('mammoth/mammoth.browser.js')
        const mammoth = mod.default ?? mod
        const out = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) })
        const r = htmlToQuickBookMarkdown(out.value, {})
        text = /^##\s/m.test(r.markdown) ? r.markdown : textToQuickBookMarkdown(r.markdown).markdown
        for (const [p, b] of r.assets) nextAssets.set(p, b)
        notes.push(...r.warnings.slice(0, 2))
      } else if (/^(png|jpe?g|webp|gif|svg)$/.test(ext)) { nextAssets.set(`assets/${file.name.replace(/[^\w.-]+/g, '-')}`, bytes); notes.push(t('compose.note.image', { name: file.name })) }
      else if (ext === 'zip') notes.push(t('compose.note.zip'))
      else notes.push(t('compose.note.unknown', { name: file.name }))
    }
    setAssets(nextAssets)
    if (text !== null) { update({ markdown: text, title: '', tagline: '' }); setTab('write') }
    setBusy('')
    for (const n of notes.slice(0, 3)) toast(n)
  }

  function insert(snippet: string) {
    const el = editorRef.current
    const value = draft!.markdown
    const at = el ? el.selectionStart : value.length
    const next = value.slice(0, at) + snippet + value.slice(el ? el.selectionEnd : at)
    update({ markdown: next })
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(at + snippet.length, at + snippet.length) })
  }

  /* ── keep on this device ─────────────────────────────────────────── */
  async function keepHere() {
    if (!composed?.ok) return
    setBusy(t('compose.saving'))
    try {
      const now = new Date().toISOString()
      const local = await listLocalBooks()
      // a book on this device never hides behind a published one with the same slug
      let { manifest } = composed.build
      const clash = published.some((s) => s.slug === manifest.slug || s.storyId === manifest.storyId)
      const source = clash ? composeQuickBook({
        markdown: md, sdk: sdkText, theme: draft!.theme, title: draft!.title || undefined, tagline: draft!.tagline || undefined, rating: draft!.rating, assets,
        storyId: published.some((s) => s.storyId === draft!.storyId) ? crypto.randomUUID() : draft!.storyId,
        slug: `${manifest.slug}-mine`,
      }) : composed
      if (!source.ok) throw new Error('the private copy did not build')
      manifest = source.build.manifest
      const st = stampComposed(source, now)!
      const reg = applyPublish(emptyRegistry(), {
        manifest, releaseId: source.pack!.releaseId, packageHash: source.pack!.packageHash, totalBytes: source.validation!.totalBytes,
        validation: { errors: [], warnings: source.validation!.warnings }, notes: '', channel: 'production', now,
      })
      const story = reg.registry.stories[0] as CatalogStory
      const cover = svgUri(source.cover.svg)
      story.cover = cover
      story.releases = story.releases.map((r) => ({ ...r, cover }))
      for (const old of local.find((l) => l.storyId === story.storyId)?.releases ?? []) if (old.releaseId !== source.pack!.releaseId) await removeDownload(old.releaseId)
      await saveDownload(source.pack!.releaseId, {
        slug: story.slug, storyId: story.storyId, releaseId: source.pack!.releaseId, version: manifest.version, bytes: st.entry.byteLength,
        blob: new Blob([st.entry as BlobPart], { type: 'text/html' }), entryName: st.entrypoint,
        integrityOk: true, verifiedHash: 'sha256:' + sha256Hex(st.entry), at: now, local: true,
      })
      await putLocalBook(story)
      await refreshCatalog()
      toast(t('compose.saved', { title: story.title }))
      navigate(`/play/${story.slug}`)
    } catch (e: any) {
      toast(t('compose.saveFailed', { error: e.message }))
    } finally { setBusy('') }
  }

  /* ── publish for everyone (Studio) ───────────────────────────────── */
  async function publishForEveryone() {
    const client = gh()
    if (!client || !composed?.ok) return
    const say = (m: string) => setLog((l) => [...l, m])
    setPublishing(true); setLog([]); setRun(null)
    const { summary } = composed
    try {
      const session = adminSession()
      const r = await client.publishStory({ branch: session.branch, slug: summary.slug, version: summary.version, files: composed.source, onProgress: say })
      say(t('compose.pub.committed', { sha: r.commitSha.slice(0, 7) }))
      const first = await watchRun(client, null, () => client.findRunForCommit(r.commitSha), setRun)
      if (first?.conclusion !== 'success') { say(t('compose.pub.failed', { result: first?.conclusion ?? 'unknown' })); return }
      say(t('compose.pub.beta', { id: summary.releaseId ?? '' }))
      if (goLive) {
        say(t('compose.pub.goingLive'))
        const last: { u: OpUpdate | null } = { u: null }
        await runOp('publish', { slug: summary.slug, channel: 'production' }, (u) => { setRun(u); last.u = u })
        if (last.u?.phase === 'error' || (last.u?.conclusion && last.u.conclusion !== 'success')) { say(t('compose.pub.failed', { result: last.u?.conclusion ?? last.u?.message ?? 'error' })); return }
      }
      say(t('compose.pub.waiting'))
      for (let i = 0; i < 60; i++) {
        await refreshCatalog()
        const { catalog } = await import('../../lib/catalog')
        const c = await catalog(true)
        const s = c.stories.find((x) => x.storyId === summary.storyId && !x.local)
        const ch = goLive ? 'production' : 'beta'
        if (s && s.channels?.[ch]?.releaseId === summary.releaseId) { say(t(goLive ? 'compose.pub.live' : 'compose.pub.liveBeta', { title: summary.title })); return }
        await new Promise((res) => setTimeout(res, 5000))
      }
      say(t('compose.pub.slow'))
    } catch (e: any) {
      say('✗ ' + e.message)
    } finally { setPublishing(false) }
  }

  const ok = !!composed?.ok
  const errors = composed?.issues.filter((g) => g.severity === 'error') ?? []
  const worth = composed?.issues.filter((g) => g.severity !== 'error') ?? []
  const s = composed?.summary
  const client = mode === 'studio' ? gh() : null

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">{mode === 'studio' ? t('compose.eyebrowStudio') : t('compose.eyebrow')}</p>
          <h1>{mode === 'studio' ? t('compose.titleStudio') : t('compose.title')}</h1>
          <p className="lede">{kind === 'link' ? (mode === 'studio' ? t('link.ledeStudio') : t('link.lede')) : mode === 'studio' ? t('compose.ledeStudio') : t('compose.lede')}</p>
        </div>
        <div className="btn-row" style={{ margin: 0 }}>
          {mode === 'studio' && <a className="btn ghost" href="#/admin">← Studio</a>}
          {kind === 'make' && draft.markdown && (
            <button className="btn ghost" onClick={async () => { if (confirm(t('compose.startOverConfirm'))) { setAssets(new Map()); setDraft(emptyDraft()); setTab('templates'); setPreview(false) } }}>{t('compose.startOver')}</button>
          )}
        </div>
      </div>

      <div className="pill-tabs mode-switch" role="group" aria-label={t('compose.kindSwitch')}>
        <button type="button" aria-pressed={kind === 'make'} onClick={() => navigate(mode === 'studio' ? '/admin/publish' : '/add')}><PenIcon /> {t('compose.kind.make')}</button>
        <button type="button" aria-pressed={kind === 'link'} onClick={() => navigate(mode === 'studio' ? '/admin/link' : '/add/link')} data-testid="mode-link"><GlobeIcon /> {t('compose.kind.link')}</button>
      </div>

      {kind === 'link' ? <LinkBook mode={mode} /> : (
      <div className="composer">
        <div style={{ minWidth: 0 }}>
          <div className="pill-tabs" role="tablist" aria-label={t('compose.sources')}>
            {([['templates', t('compose.tab.templates'), TemplateIcon], ['upload', t('compose.tab.upload'), UploadIcon], ['write', t('compose.tab.write'), PenIcon]] as [Tab, string, any][]).map(([k, label, Icon]) => (
              <button key={k} role="tab" id={`tab-${k}`} aria-selected={tab === k} aria-controls={`panel-${k}`} onClick={() => setTab(k)}><Icon /> {label}</button>
            ))}
          </div>

          {tab === 'templates' && (
            <div role="tabpanel" id="panel-templates" aria-labelledby="tab-templates">
              <div className="templates">
                {STARTER_BOOKS.map((b) => (
                  <button key={b.id} type="button" className="template" data-template={b.id}
                    onClick={() => { if (draft.markdown && !confirm(t('compose.replaceConfirm'))) return; update({ markdown: b.markdown, theme: b.theme, title: '', tagline: '' }); setTab('write') }}>
                    <strong>{b.title}</strong><span>{b.blurb}</span><span className="badge">{b.theme}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === 'upload' && (
            <div role="tabpanel" id="panel-upload" aria-labelledby="tab-upload">
              <div className="dropzone" data-over={over} onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
                onDrop={(e) => { e.preventDefault(); setOver(false); ingest(e.dataTransfer.files) }} onClick={() => inputRef.current?.click()}>
                <UploadIcon />
                <p><strong>{t('compose.dropTitle')}</strong></p>
                <p className="small">{t('compose.dropBody')} <button type="button" className="link-btn" onClick={(e) => { e.stopPropagation(); inputRef.current?.click() }}>{t('compose.choose')}</button></p>
                <input ref={inputRef} className="sr" type="file" multiple accept=".md,.markdown,.txt,.docx,.png,.jpg,.jpeg,.webp,.gif,.svg" aria-label={t('compose.chooseLabel')} data-testid="compose-upload"
                  onChange={(e) => { if (e.target.files?.length) ingest(e.target.files); e.target.value = '' }} />
                {busy && <p role="status">{busy}</p>}
              </div>
              <p className="small muted">{t('compose.dropHint')}</p>
            </div>
          )}

          {tab === 'write' && (
            <div role="tabpanel" id="panel-write" aria-labelledby="tab-write">
              <div className="editor-toolbar" role="toolbar" aria-label={t('compose.toolbar')}>
                {SNIPPETS.map(([key, snip]) => <button key={key} type="button" onClick={() => insert(snip)}>+ {t(key)}</button>)}
                {[...assets.keys()].slice(0, 3).map((p) => (
                  <button key={p} type="button" onClick={() => insert(`\n![${t('compose.altPlaceholder')}](${p})\n`)}>+ {p.replace('assets/', '')}</button>
                ))}
              </div>
              <label htmlFor="compose-md" className="sr">{t('compose.editorLabel')}</label>
              <textarea id="compose-md" ref={editorRef} className="editor" spellCheck value={draft.markdown} placeholder={t('compose.editorPlaceholder')}
                onChange={(e) => update({ markdown: e.target.value })} />
              <details className="notes"><summary>{t('compose.cheatsheet')}</summary>
                <p className="small">{t('compose.cheatsheetBody')}</p>
              </details>
            </div>
          )}

          <section className="panel" aria-labelledby="details-h" style={{ marginTop: '1.4rem' }}>
            <h2 id="details-h" style={{ marginTop: 0 }}>{t('compose.details')}</h2>
            {mode === 'studio' && published.length > 0 && (
              <div className="field">
                <label htmlFor="compose-target">{t('compose.target')}</label>
                <select id="compose-target" value={draft.target} onChange={(e) => update({ target: e.target.value })}>
                  <option value="">{t('compose.targetNew')}</option>
                  {published.map((p) => <option key={p.storyId} value={p.storyId}>{t('compose.targetUpdate', { title: p.title })}</option>)}
                </select>
              </div>
            )}
            <div className="form-grid">
              <div className="field">
                <label htmlFor="compose-title">{t('compose.bookTitle')}</label>
                <input id="compose-title" type="text" value={draft.title} placeholder={s?.title ?? ''} onChange={(e) => update({ title: e.target.value })} />
                <span className="hint">{t('compose.bookTitleHint')}</span>
              </div>
              <div className="field">
                <label htmlFor="compose-tagline">{t('compose.tagline')}</label>
                <input id="compose-tagline" type="text" value={draft.tagline} placeholder={s?.tagline ?? ''} onChange={(e) => update({ tagline: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="compose-rating">{t('compose.rating')}</label>
                <select id="compose-rating" value={draft.rating} onChange={(e) => update({ rating: e.target.value })}>
                  {['everyone', 'teen', 'mature'].map((r) => <option key={r} value={r}>{t('rating.' + r)}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="compose-warnings">{t('compose.warnings')}</label>
                <input id="compose-warnings" type="text" value={draft.warnings} placeholder={t('compose.warningsPlaceholder')} onChange={(e) => update({ warnings: e.target.value })} />
              </div>
            </div>
            <span className="label" id="theme-label" style={{ fontWeight: 600, fontSize: '0.9rem' }}>{t('compose.theme')}</span>
            <div className="theme-picker" role="group" aria-labelledby="theme-label" style={{ marginTop: '0.4rem' }}>
              {THEME_NAMES.map((name: string) => {
                const look = THEME_LOOK[name] ?? THEME_LOOK.manuscript
                return (
                  <button key={name} type="button" aria-pressed={draft.theme === name} onClick={() => update({ theme: name })}
                    style={{ ['--t-bg' as any]: look.bg, ['--t-ink' as any]: look.ink, ['--t-font' as any]: look.font }}>
                    <i aria-hidden="true" />{t('theme.' + name)}
                  </button>
                )
              })}
            </div>
          </section>

          {preview && ok && composed && (
            <section className="panel" aria-label={t('compose.preview')} style={{ marginTop: '1.4rem' }}>
              <Preview files={composed.build.files} manifest={composed.build.manifest} releaseId={composed.pack!.releaseId} packageHash={composed.pack!.packageHash} />
            </section>
          )}
        </div>

        <aside className="composer-side" aria-label={t('compose.status')}>
          <div className="status-card">
            {composed ? <img className="cover-preview" src={svgUri(composed.cover.svg)} alt={t('compose.coverAlt', { title: s?.title ?? '' })} />
              : <div className="cover-preview" aria-hidden="true" />}
            <h2>{s?.title ?? t('compose.emptyTitle')}</h2>
            {!composed && <p className="small muted">{t('compose.emptyBody')}</p>}
            {composed && (
              <>
                <p className={`verdict ${ok ? 'good' : 'bad'}`} role="status" data-testid="compose-verdict">
                  {ok ? <><CheckIcon /> {t('compose.ready')}</> : t('compose.notReady', { n: errors.reduce((n, g) => n + g.items.length, 0) })}
                </p>
                <ul className="facts-mini">
                  <li><b>{s!.chapters}</b> {t('compose.fact.chapters')} · <b>{s!.secrets}</b> {t('compose.fact.secrets')} · <b>{s!.choices}</b> {t('compose.fact.choices')} · <b>{s!.endings}</b> {t('compose.fact.endings')}</li>
                  <li><b>{s!.words.toLocaleString()}</b> {t('compose.fact.words')}{s!.minutes ? <> · ≈ <b>{s!.minutes[0]}–{s!.minutes[1]}</b> min</> : null}{ok ? <> · {formatBytes(s!.totalBytes)}</> : null}</li>
                  <li>v{s!.version} · <code className="mono">{s!.slug}</code>{s!.releaseId ? <> · <code className="mono">{s!.releaseId}</code></> : null}</li>
                </ul>
                {errors.length > 0 && (
                  <ul className="issues">
                    {errors.slice(0, 4).map((g) => <li key={g.code} className="error"><strong>{g.items[0]}</strong>{g.items.length > 1 && <span className="small muted"> (+{g.items.length - 1})</span>}<p className="fix">{g.fix}</p></li>)}
                  </ul>
                )}
                {ok && worth.length > 0 && (
                  <details className="notes"><summary>{t('compose.worth', { n: worth.reduce((n, g) => n + g.items.length, 0) })}</summary>
                    <ul className="small">{worth.flatMap((g) => g.items).slice(0, 8).map((w, i) => <li key={i}>{w}</li>)}</ul>
                  </details>
                )}
              </>
            )}
            <div className="btn-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              {mode === 'studio' && (client
                ? <button className="btn accent big" disabled={!ok || publishing} onClick={publishForEveryone}><GlobeIcon /> {publishing ? t('compose.publishing') : t('compose.publish')}</button>
                : <a className="btn accent big" href="#/admin/connect"><GlobeIcon /> {t('compose.connectToPublish')}</a>)}
              {mode === 'studio' && client && (
                <label className="switch small"><input type="checkbox" checked={goLive} onChange={(e) => setGoLive(e.target.checked)} /> {t('compose.goLive')}</label>
              )}
              <button className={`btn ${mode === 'reader' ? 'big' : 'secondary'}`} disabled={!ok || !!busy} onClick={keepHere} data-testid="compose-keep"><PlayIcon /> {busy && busy === t('compose.saving') ? busy : t('compose.readHere')}</button>
              <button className="btn secondary" disabled={!ok} aria-pressed={preview} onClick={() => setPreview(!preview)}>{preview ? t('compose.hidePreview') : t('compose.showPreview')}</button>
              <button className="btn ghost" disabled={!composed} onClick={() => composed && downloadBytes(mapToZip(composed.source, s!.slug), `${s!.slug}.zip`)}><DownloadIcon /> {t('compose.download')}</button>
            </div>
            <p className="small muted" style={{ margin: 0 }}>{mode === 'reader' ? t('compose.privateNote') : t('compose.studioNote')}</p>
            {mode === 'reader' && admin && <p className="small" style={{ marginBottom: 0 }}><a href="#/admin/publish">{t('compose.toStudio')}</a></p>}
          </div>

          {(log.length > 0 || run) && (
            <div className="panel" aria-live="polite">
              <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>{t('compose.progress')}</h2>
              <ol className="small">{log.map((l, i) => <li key={i}>{l}</li>)}</ol>
              {run && <p className="small"><span className={`status-dot ${run.phase === 'completed' || run.phase === 'done' ? (run.conclusion === 'success' ? 'good' : run.conclusion ? 'bad' : 'good') : run.phase === 'error' ? 'bad' : 'run'}`} />CI: {run.phase}{run.conclusion ? ` · ${run.conclusion}` : ''} {run.url && <a href={run.url} target="_blank" rel="noreferrer">{t('compose.openRun')}</a>}{run.cli && <code className="mono"> {run.cli}</code>}</p>}
            </div>
          )}
        </aside>
      </div>
      )}
    </main>
  )
}

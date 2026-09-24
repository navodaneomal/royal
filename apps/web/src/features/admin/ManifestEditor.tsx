/* Wizard step 3 — the manifest as a form over ManifestSchema, with live zod
   errors and a raw JSON tab that stays in sync. For Quick Books, the story
   structure (checkpoints, items, achievements, choices, endings) comes from
   the text and is shown read-only. */
import React, { useMemo, useState } from 'react'
import { ManifestSchema, CAPABILITIES } from '@storyframe/protocol'
import { slugify, THEMES, THEME_NAMES } from '@storyframe/publishing'

type Props = {
  manifest: any
  effective: any               // what the build produced (quick: compiled)
  lane: 'quick' | 'crafted' | 'prebuilt'
  locked: { storyId: boolean; slug: boolean; reason?: string }
  latestVersion?: string | null
  onChange: (next: any) => void
}

const bump = (v: string, part: 'patch' | 'minor' | 'major') => {
  const [a, b, c] = (v || '0.0.0').split('.').map(Number)
  return part === 'major' ? `${a + 1}.0.0` : part === 'minor' ? `${a}.${b + 1}.0` : `${a}.${b}.${c + 1}`
}

export function ManifestEditor({ manifest, effective, lane, locked, latestVersion, onChange }: Props) {
  const [tab, setTab] = useState<'form' | 'json'>('form')
  const [json, setJson] = useState(() => JSON.stringify(manifest, null, 2))
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [slugTouched, setSlugTouched] = useState(false)
  const check = useMemo(() => ManifestSchema.safeParse(effective ?? manifest), [effective, manifest])
  const errFor = (path: string) => check.success ? null : check.error.issues.filter((i: any) => i.path.join('.').startsWith(path)).map((i: any) => i.message).join('; ') || null

  const set = (path: string, value: any) => {
    const next = structuredClone(manifest)
    const keys = path.split('.')
    let o = next
    for (const k of keys.slice(0, -1)) o = o[k] ??= {}
    o[keys.at(-1)!] = value
    if (path === 'title' && !slugTouched && !locked.slug) next.slug = slugify(String(value), 'untitled-book')
    onChange(next)
    setJson(JSON.stringify(next, null, 2))
  }
  const quick = lane === 'quick'
  const content = manifest.content ?? {}
  const est = content.estimatedMinutes ?? { firstSession: 10, total: [10, 20] }


  return (
    <div>
      <div className="tabs" role="tablist" aria-label="Manifest editor">
        <button role="tab" aria-selected={tab === 'form'} onClick={() => { setTab('form') }}>Form</button>
        <button role="tab" aria-selected={tab === 'json'} onClick={() => { setJson(JSON.stringify(manifest, null, 2)); setTab('json') }}>Raw JSON</button>
      </div>

      <p className={`callout ${check.success ? 'good' : 'bad'}`} role="status">
        {check.success ? '✓ The manifest matches the schema.' : `${check.error.issues.length} schema issue(s): ${check.error.issues.slice(0, 3).map((i: any) => `${i.path.join('.')}: ${i.message}`).join(' · ')}`}
      </p>

      {tab === 'json' ? (
        <div className="field">
          <label htmlFor="m-json">storyframe.json</label>
          <textarea id="m-json" className="json" spellCheck={false} value={json} onChange={(e) => setJson(e.target.value)}
            onBlur={() => { try { const v = JSON.parse(json); setJsonError(null); onChange(v) } catch (e: any) { setJsonError(e.message) } }} />
          {jsonError ? <span className="err" role="alert">Not valid JSON: {jsonError} — your last valid version is kept.</span> : <span className="hint">Edits apply when you leave the box.</span>}
        </div>
      ) : (
        <>
          <h3>Identity</h3>
          <div className="form-grid">
            <Field label="Title" path="title" error={errFor('title')}><input id="m-title" type="text" value={manifest.title ?? ''} onChange={(e) => set('title', e.target.value)} /></Field>
            <Field label="Slug (web address)" path="slug" error={errFor('slug')} hint={locked.slug ? 'Locked — this book is already published under this slug.' : 'Lowercase words and dashes. Readers see it in links.'}>
              <input id="m-slug" type="text" value={manifest.slug ?? ''} disabled={locked.slug} onChange={(e) => { setSlugTouched(true); set('slug', e.target.value) }} />
            </Field>
            <Field label="Story ID" path="storyId" error={errFor('storyId')} hint={locked.storyId ? `Locked after first publish${locked.reason ? ' — ' + locked.reason : ''}. It identifies this book forever.` : 'Minted for you. Locked once the book is published.'}>
              <span style={{ display: 'flex', gap: '0.4rem' }}>
                <input id="m-storyId" type="text" className="mono" value={manifest.storyId ?? ''} readOnly />
                {!locked.storyId && <button type="button" className="btn small secondary" onClick={() => set('storyId', crypto.randomUUID())}>New</button>}
              </span>
            </Field>
            <Field label="Version" path="version" error={errFor('version')} hint={latestVersion ? `Latest published: v${latestVersion}` : 'Semantic version: major.minor.patch'}>
              <span style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <input id="m-version" type="text" value={manifest.version ?? ''} onChange={(e) => set('version', e.target.value)} style={{ width: '7rem' }} />
                {(['patch', 'minor', 'major'] as const).map((p) => <button key={p} type="button" className="btn small secondary" onClick={() => set('version', bump(latestVersion ?? manifest.version, p))}>+{p}</button>)}
              </span>
            </Field>
          </div>
          <Field label="Tagline" path="tagline" error={errFor('tagline')}><input id="m-tagline" type="text" value={manifest.tagline ?? ''} maxLength={240} onChange={(e) => set('tagline', e.target.value)} /></Field>
          <Field label="Synopsis" path="synopsis" error={errFor('synopsis')} hint="Shown on the story page. No spoilers."><textarea id="m-synopsis" value={manifest.synopsis ?? ''} maxLength={1200} onChange={(e) => set('synopsis', e.target.value)} /></Field>
          <div className="form-grid">
            <Field label="Accent colour" path="accent" error={errFor('accent')} hint="Tints the Continue hero on the shelf.">
              <input id="m-accent" type="color" value={manifest.accent ?? '#8a6420'} onChange={(e) => set('accent', e.target.value)} style={{ width: '4rem', height: '2.4rem', padding: 2 }} />
            </Field>
            <Field label="Language" path="languages" error={errFor('languages')}><input id="m-languages" type="text" value={(manifest.languages ?? ['en']).join(', ')} onChange={(e) => { const l = e.target.value.split(',').map((x) => x.trim()).filter(Boolean); const n = { ...manifest, languages: l, defaultLanguage: l[0] ?? 'en' }; onChange(n) }} /></Field>
            <Field label="State schema version" path="stateSchemaVersion" error={errFor('stateSchemaVersion')} hint="Raise it only when you rename or remove IDs — and add a migration.">
              <input id="m-stateSchemaVersion" type="number" min={1} value={manifest.stateSchemaVersion ?? 1} onChange={(e) => set('stateSchemaVersion', Number(e.target.value))} />
            </Field>
          </div>
          {quick && (
            <Field label="Theme" path="build" error={errFor('build')} hint={THEMES[manifest.build?.quickbook?.theme ?? 'manuscript']?.description}>
              <select id="m-build" value={manifest.build?.quickbook?.theme ?? 'manuscript'} onChange={(e) => set('build', { ...(manifest.build ?? {}), quickbook: { ...(manifest.build?.quickbook ?? { source: 'book.md' }), theme: e.target.value } })}>
                {THEME_NAMES.map((n: string) => <option key={n} value={n}>{THEMES[n].label}</option>)}
              </select>
            </Field>
          )}

          <h3>Content</h3>
          <div className="form-grid">
            <Field label="Rating" path="content.rating" error={errFor('content.rating')}>
              <select id="m-content.rating" value={content.rating ?? 'everyone'} onChange={(e) => set('content', { ...content, rating: e.target.value })}>
                <option value="everyone">Everyone</option><option value="teen">Teen</option><option value="mature">Mature</option>
              </select>
            </Field>
            <Field label="Content warnings" path="content.warnings" error={errFor('content.warnings')} hint="Comma-separated. Readers reveal them intentionally.">
              <input id="m-content.warnings" type="text" value={(content.warnings ?? []).join(', ')} onChange={(e) => set('content', { ...content, warnings: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
            </Field>
            {!quick && (
              <Field label="Minutes (first sitting · whole min · max)" path="content.estimatedMinutes" error={errFor('content.estimatedMinutes')}>
                <span style={{ display: 'flex', gap: '0.3rem' }}>
                  {[est.firstSession, est.total?.[0], est.total?.[1]].map((v: number, i: number) => (
                    <input key={i} type="number" min={1} aria-label={['first sitting', 'minimum', 'maximum'][i]} value={v ?? 1} style={{ width: '5rem' }}
                      onChange={(e) => { const n = Number(e.target.value); const next = { firstSession: est.firstSession, total: [...(est.total ?? [1, 1])] as number[] }; if (i === 0) next.firstSession = n; else next.total[i - 1] = n; set('content', { ...content, estimatedMinutes: next }) }} />
                  ))}
                </span>
              </Field>
            )}
            <Field label="Offline budget (MB)" path="offline.maxBytes" error={errFor('offline.maxBytes')} hint="Readers download all of it. Keep it honest.">
              <input id="m-offline.maxBytes" type="number" min={0.1} step={0.1} value={Math.round(((manifest.offline?.maxBytes ?? 5242880) / 1048576) * 10) / 10} onChange={(e) => set('offline', { eligible: true, required: [manifest.entrypoint ?? 'index.html'], optional: [], ...(manifest.offline ?? {}), maxBytes: Math.round(Number(e.target.value) * 1048576) })} />
            </Field>
          </div>

          {quick ? (
            <>
              <h3>Structure (from your text)</h3>
              <p className="small muted">Chapters, secrets, achievements, choices, and endings come from book.md. Edit the text to change them.</p>
              <StructureSummary m={effective ?? manifest} />
            </>
          ) : (
            <>
              <h3>Capabilities</h3>
              <div className="chips">
                {CAPABILITIES.map((c: string) => (
                  <button key={c} type="button" className="chip" aria-pressed={(manifest.capabilities ?? []).includes(c)}
                    onClick={() => { const cur = new Set(manifest.capabilities ?? []); cur.has(c) ? cur.delete(c) : cur.add(c); set('capabilities', [...cur]) }}>{c}</button>
                ))}
              </div>
              <ListEditor title="Checkpoints" hint="Reader-facing labels, in story language. Drag (or use ↑ ↓) to set the order." items={manifest.checkpoints ?? []} path="checkpoints" err={errFor('checkpoints')}
                fields={[['id', 'ID'], ['label', 'Label']]} blank={{ id: '', label: '', order: 0 }} reorder
                onChange={(list) => set('checkpoints', list.map((c: any, i: number) => ({ ...c, order: (i + 1) * 10 })))} />
              <ListEditor title="Items" hint="Alt text is required — the Archive reads it aloud." items={manifest.items ?? []} path="items" err={errFor('items')}
                fields={[['id', 'ID'], ['name', 'Name'], ['alt', 'Alt text (required)'], ['description', 'Description']]} blank={{ id: '', name: '', alt: '', description: '' }} onChange={(l) => set('items', l)} />
              <ListEditor title="Achievements" items={manifest.achievements ?? []} path="achievements" err={errFor('achievements')}
                fields={[['id', 'ID'], ['name', 'Name'], ['description', 'Description']]} toggle={['secret', 'Secret']} blank={{ id: '', name: '', description: '', secret: false }} onChange={(l) => set('achievements', l)} />
              <ListEditor title="Choices" hint="Canonical choices never flip once made. Options are comma-separated IDs." items={(manifest.choices ?? []).map((c: any) => ({ ...c, options: (c.options ?? []).join(', ') }))} path="choices" err={errFor('choices')}
                fields={[['id', 'ID'], ['label', 'Label'], ['options', 'Options']]} blank={{ id: '', label: '', options: '' }}
                onChange={(l) => set('choices', l.map((c: any) => ({ ...c, options: String(c.options).split(',').map((x: string) => x.trim()).filter(Boolean) })))} />
              <ListEditor title="Endings" items={manifest.endings ?? []} path="endings" err={errFor('endings')}
                fields={[['id', 'ID'], ['name', 'Name']]} blank={{ id: '', name: '' }} onChange={(l) => set('endings', l)} />
            </>
          )}
        </>
      )}
    </div>
  )
}

function Field({ label, path, hint, error, children }: { label: string; path: string; hint?: string; error: string | null; children: React.ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={`m-${path}`}>{label}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
      {error && <span className="err" role="alert">{error}</span>}
    </div>
  )
}

function StructureSummary({ m }: { m: any }) {
  const rows: [string, string[]][] = [
    ['Chapters (checkpoints)', (m.checkpoints ?? []).map((c: any) => `${c.label} (${c.id})`)],
    ['Secrets (items)', (m.items ?? []).map((i: any) => `${i.name} (${i.id})`)],
    ['Achievements', (m.achievements ?? []).map((a: any) => `${a.name}${a.secret ? ' — secret' : ''}`)],
    ['Choices', (m.choices ?? []).map((c: any) => `${c.id}: ${c.options.join(' / ')}`)],
    ['Endings', (m.endings ?? []).map((e: any) => e.name)],
  ]
  return (
    <div className="table-wrap"><table className="op"><tbody>
      {rows.map(([k, v]) => <tr key={k}><th scope="row" style={{ width: '12rem' }}>{k}</th><td>{v.length ? v.join(' · ') : <span className="muted">none</span>}</td></tr>)}
    </tbody></table></div>
  )
}

function ListEditor({ title, hint, items, fields, blank, onChange, reorder, toggle, err, path }: {
  title: string; hint?: string; items: any[]; fields: [string, string][]; blank: any; onChange: (l: any[]) => void
  reorder?: boolean; toggle?: [string, string]; err?: string | null; path: string
}) {
  const [drag, setDrag] = useState<number | null>(null)
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return
    const next = [...items]
    const [x] = next.splice(from, 1)
    next.splice(to, 0, x)
    onChange(next)
  }
  return (
    <section aria-label={title} style={{ margin: '1.2rem 0' }}>
      <div className="section-head"><h3 style={{ margin: 0 }}>{title} <span className="small muted">({items.length})</span></h3>
        <button type="button" className="btn small secondary" onClick={() => onChange([...items, structuredClone(blank)])}>Add</button></div>
      {hint && <p className="small muted" style={{ margin: '0.3rem 0 0.6rem' }}>{hint}</p>}
      {err && <p className="err small" role="alert">{err}</p>}
      <div className="list-editor">
        {items.map((it, i) => (
          <div key={i} className={`item ${drag === i ? 'dragging' : ''}`} draggable={reorder}
            onDragStart={() => setDrag(i)} onDragEnd={() => setDrag(null)}
            onDragOver={(e) => { if (reorder) e.preventDefault() }} onDrop={() => { if (drag !== null && drag !== i) move(drag, i); setDrag(null) }}>
            {reorder ? (
              <span style={{ display: 'grid', gap: 2 }}>
                <span className="handle" aria-hidden="true">⠿</span>
                <button type="button" className="btn small ghost" aria-label={`Move ${it.label || it.id || 'item'} up`} onClick={() => move(i, i - 1)}>↑</button>
                <button type="button" className="btn small ghost" aria-label={`Move ${it.label || it.id || 'item'} down`} onClick={() => move(i, i + 1)}>↓</button>
              </span>
            ) : <span />}
            <div className="fields">
              {fields.map(([k, label]) => (
                <label key={k} className="field" style={{ margin: 0 }}>
                  <span className="hint">{label}</span>
                  <input type="text" value={it[k] ?? ''} onChange={(e) => { const next = [...items]; next[i] = { ...it, [k]: e.target.value }; onChange(next) }} aria-label={`${title} ${i + 1} ${label}`} />
                </label>
              ))}
              {toggle && <label className="switch small"><input type="checkbox" checked={!!it[toggle[0]]} onChange={(e) => { const next = [...items]; next[i] = { ...it, [toggle[0]]: e.target.checked }; onChange(next) }} /> {toggle[1]}</label>}
              {path === 'checkpoints' && <span className="hint">order {it.order}</span>}
            </div>
            <button type="button" className="btn small danger" aria-label={`Remove ${title} ${i + 1}`} onClick={() => onChange(items.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
      </div>
    </section>
  )
}

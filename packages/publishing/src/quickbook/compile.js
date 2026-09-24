/**
 * Quick Book compiler — Markdown with directives → a native SDK story.
 *
 * Isomorphic: the Admin Studio preview and CI call this exact function, so
 * what an author previews is byte-for-byte what readers get.
 *
 * Mapping to the manifest:
 *   ## chapter            → checkpoint (label = heading, order = 10, 20, 30 …);
 *                           committed when the reader enters the chapter
 *   :::secret             → item (hidden until the reader reveals it)
 *   ::achievement         → achievement (unlocks when its block becomes visible)
 *   :::choice + :::branch → canonical choice; only the chosen branch ever shows
 *   :::ending             → ending (recorded when it becomes visible)
 */
import { parseFrontMatter } from './frontmatter.js'
import { parseBook, renderInline, escapeHtml, slugify } from './markdown.js'
import { THEMES, themeCss } from '../themes/index.js'
import { QUICKBOOK_RUNTIME } from '../themes/runtime.js'

const CHECKPOINT_RE = /^[a-z0-9]+(?:[/-][a-z0-9]+)*$/i
const WORDS_PER_MINUTE = 230
export const DEFAULT_THEME = 'manuscript'

const titleCase = (id) => id.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
const attr = (v) => escapeHtml(v)

/**
 * @param {{ markdown:string, manifest:object, theme?:string }} input
 * @returns {{ html:string, manifest:object, errors:string[], warnings:string[], stats:object }}
 */
export function compileQuickBook({ markdown, manifest: rawManifest = {}, theme: buildTheme, themeOverride }) {
  const errors = []
  const warnings = []
  const fm = parseFrontMatter(markdown)
  errors.push(...fm.errors)
  const { doc, errors: parseErrors } = parseBook(fm.body, fm.bodyLine)
  errors.push(...parseErrors)
  const warn = (w) => { if (!warnings.includes(w)) warnings.push(w) }
  const data = fm.data

  // precedence: explicit override (Admin preview) > front matter > build block > default
  const themeName = String(themeOverride ?? data.theme ?? buildTheme ?? DEFAULT_THEME).toLowerCase()
  if (!THEMES[themeName]) errors.push(`unknown theme "${themeName}" — choose one of: ${Object.keys(THEMES).join(', ')}`)

  if (!doc.chapters.length) errors.push('a Quick Book needs at least one "## Chapter" heading')

  /* ── identities ─────────────────────────────────────────────────── */
  const chapterIds = new Set()
  const chapters = doc.chapters.map((c, i) => {
    let id = c.explicitId
    if (id && !CHECKPOINT_RE.test(id)) { errors.push(`line ${c.line}: chapter id "${id}" must be letters, digits, and dashes`); id = null }
    if (!id) {
      id = slugify(c.title, `chapter-${i + 1}`)
      warn(`chapter "${c.title}" has no explicit {#id} — renaming it later would break readers' resume; write "## ${c.title} {#${id}}"`)
    }
    let unique = id
    for (let n = 2; chapterIds.has(unique); n++) unique = `${id}-${n}`
    if (unique !== id) errors.push(`line ${c.line}: chapter id "${id}" is used twice`)
    chapterIds.add(unique)
    return { ...c, id: unique, order: (i + 1) * 10 }
  })

  const items = []
  const achievements = []
  const choices = []
  const endings = []
  const branches = []
  const ids = { item: new Set(), achievement: new Set(), choice: new Set(), ending: new Set() }
  let words = 0
  let secretSeq = 0

  const claim = (kind, id, line) => {
    if (ids[kind].has(id)) { errors.push(`line ${line}: ${kind} id "${id}" is used twice`); return false }
    ids[kind].add(id); return true
  }
  const countWords = (t) => { words += (String(t).match(/[\p{L}\p{N}’']+/gu) ?? []).length }

  /* ── render ─────────────────────────────────────────────────────── */
  function renderBlocks(blocks, chapter) {
    return blocks.map((b) => renderBlock(b, chapter)).join('\n')
  }

  function renderBlock(b, chapter) {
    switch (b.type) {
      case 'p': countWords(b.text); return `<p>${renderInline(b.text, warn)}</p>`
      case 'h': countWords(b.text); return `<h${b.level}>${renderInline(b.text, warn)}</h${b.level}>`
      case 'quote': countWords(b.text); return `<blockquote><p>${renderInline(b.text, warn)}</p></blockquote>`
      case 'list': {
        const tag = b.ordered ? 'ol' : 'ul'
        return `<${tag}>${b.items.map((it) => { countWords(it.text); return `<li>${renderInline(it.text, warn)}</li>` }).join('')}</${tag}>`
      }
      case 'hr': return '<hr class="qb-break">'
      case 'code': return `<pre class="qb-code"><code>${escapeHtml(b.text)}</code></pre>`
      case 'image': {
        if (!b.alt) errors.push(`line ${b.line}: image ${b.src} needs alt text — ![what the image shows](${b.src})`)
        if (/^[a-z]+:|^\/\//i.test(b.src)) errors.push(`line ${b.line}: image ${b.src} must be a file in assets/, not a web address`)
        return `<figure class="qb-figure"><img src="${attr(b.src)}" alt="${attr(b.alt)}">${b.caption ? `<figcaption>${renderInline(b.caption, warn)}</figcaption>` : ''}</figure>`
      }
      case 'directive': return renderDirective(b, chapter)
      default: return ''
    }
  }

  function renderDirective(d, chapter) {
    const a = d.attrs
    const where = `line ${d.line}`
    if (!chapter && d.name !== 'achievement') errors.push(`${where}: :::${d.name} must be inside a chapter`)
    switch (d.name) {
      case 'secret': {
        const name = a.name
        const id = a.id ?? (name ? slugify(name) : null)
        if (!name) errors.push(`${where}: :::secret needs name="…" (what the reader finds)`)
        if (!a.alt) errors.push(`${where}: :::secret needs alt="…" (the Archive describes it to screen-reader users)`)
        if (!id) return ''
        if (!a.id) warn(`secret "${name}" has no explicit id — using "${id}"`)
        claim('item', id, d.line)
        const body = renderBlocks(d.children, chapter)
        const firstText = d.children.find((c) => c.type === 'p')?.text ?? ''
        items.push({
          id, name: String(name ?? id).slice(0, 120), alt: String(a.alt ?? '').slice(0, 300),
          description: String(a.description ?? firstText.replace(/[*_`]/g, '')).slice(0, 400),
          ...(chapter ? { spoilerCheckpoint: chapter.id } : {}),
        })
        const n = ++secretSeq
        return `<aside class="qb-secret" data-item="${attr(id)}">`
          + `<button type="button" class="qb-secret-btn" aria-expanded="false" aria-controls="qb-s${n}"><span class="qb-glyph" aria-hidden="true">✦</span> <span>${escapeHtml(a.hint ?? 'Something here is worth a closer look')}</span></button>`
          + `<div class="qb-secret-body" id="qb-s${n}" hidden><p class="qb-secret-name">${escapeHtml(name ?? '')}</p>${body}</div></aside>`
      }
      case 'achievement': {
        const id = a.id ?? (a.name ? slugify(a.name) : null)
        if (!a.name) errors.push(`${where}: ::achievement needs name="…"`)
        if (!id) return ''
        claim('achievement', id, d.line)
        achievements.push({ id, name: String(a.name ?? titleCase(id)).slice(0, 120), description: String(a.description ?? '').slice(0, 300), secret: a.secret === true || a.secret === 'true' })
        return `<span class="qb-ach" data-achievement="${attr(id)}" data-name="${attr(a.name ?? titleCase(id))}" hidden></span>`
      }
      case 'choice': {
        const id = a.id ?? (a.label ? slugify(a.label) : null)
        if (!id) { errors.push(`${where}: :::choice needs id="…"`); return '' }
        claim('choice', id, d.line)
        const options = []
        const prompt = []
        for (const child of d.children) {
          if (child.type === 'list') {
            for (const it of child.items) {
              const m = /^([a-z0-9][\w-]*)\s*:\s*(.+)$/i.exec(it.text)
              const optId = m ? m[1] : slugify(it.text, `option-${options.length + 1}`)
              const label = m ? m[2] : it.text
              if (options.some((o) => o.id === optId)) errors.push(`line ${it.line}: option "${optId}" appears twice in choice ${id}`)
              options.push({ id: optId, label })
              countWords(label)
            }
          } else prompt.push(renderBlock(child, chapter))
        }
        if (options.length < 2) errors.push(`${where}: choice "${id}" needs at least two options ("- option-id: What the reader picks")`)
        choices.push({ id, label: String(a.label ?? '').slice(0, 200), options: options.map((o) => o.id), line: d.line })
        const legend = a.label ? escapeHtml(a.label) : 'Choose'
        return `<fieldset class="qb-choice" data-choice="${attr(id)}"><legend>${legend}</legend>${prompt.join('\n')}`
          + `<div class="qb-options">${options.map((o) => `<button type="button" class="qb-option" data-option="${attr(o.id)}">${renderInline(o.label, warn)}</button>`).join('')}</div>`
          + `<p class="qb-chosen" hidden></p><p class="qb-choice-note">Once chosen, this stays chosen in this timeline.</p></fieldset>`
      }
      case 'branch': {
        if (!a.choice || !a.option) errors.push(`${where}: :::branch needs choice="…" and option="…"`)
        branches.push({ choice: a.choice, option: a.option, line: d.line })
        return `<div class="qb-branch" data-choice="${attr(a.choice ?? '')}" data-option="${attr(a.option ?? '')}" hidden>${renderBlocks(d.children, chapter)}</div>`
      }
      case 'ending': {
        const id = a.id ?? (a.name ? slugify(a.name) : null)
        if (!id) { errors.push(`${where}: :::ending needs id="…"`); return '' }
        claim('ending', id, d.line)
        if (!a.name) warn(`ending "${id}" has no name — readers will see "${titleCase(id)}"`)
        const name = String(a.name ?? titleCase(id)).slice(0, 120)
        endings.push({ id, name })
        return `<section class="qb-ending" data-ending="${attr(id)}" aria-label="Ending: ${attr(name)}">${renderBlocks(d.children, chapter)}`
          + `<p class="qb-ending-mark"><span>${escapeHtml(name)}</span></p>`
          + `<p class="qb-ending-actions"><button type="button" class="qb-btn" data-action="exit">Close the book</button></p></section>`
      }
      default:
        errors.push(`${where}: unknown directive :::${d.name} (secret, choice, branch, ending, achievement)`)
        return renderBlocks(d.children, chapter)
    }
  }

  const introHtml = renderBlocks(doc.intro, null)
  const chapterHtml = chapters.map((c) => renderBlocks(c.blocks, c))

  for (const b of branches) {
    const choice = choices.find((c) => c.id === b.choice)
    if (!choice) errors.push(`line ${b.line}: branch refers to unknown choice "${b.choice}"`)
    else if (!choice.options.includes(b.option)) errors.push(`line ${b.line}: branch option "${b.option}" is not an option of ${b.choice} (${choice.options.join(', ')})`)
  }
  for (const c of choices) {
    if (!branches.some((b) => b.choice === c.id)) warn(`choice "${c.id}" has no :::branch sections — the choice is recorded but changes nothing on the page`)
  }

  /* ── manifest ───────────────────────────────────────────────────── */
  const m = structuredClone(rawManifest)
  const title = String(data.title ?? doc.title ?? m.title ?? 'Untitled')
  m.title = title
  if (data.tagline !== undefined) m.tagline = String(data.tagline)
  if (data.synopsis !== undefined) m.synopsis = String(data.synopsis)
  if (data.accent !== undefined) m.accent = String(data.accent)
  const language = String(data.language ?? m.defaultLanguage ?? m.languages?.[0] ?? 'en')
  m.protocolVersion = '1.1'
  m.stateSchemaVersion = m.stateSchemaVersion ?? 1
  m.entrypoint = 'index.html'
  m.languages = [language]
  m.defaultLanguage = language
  m.capabilities = [
    'progress.write',
    ...(items.length ? ['inventory.write'] : []),
    ...(achievements.length ? ['achievement.unlock'] : []),
    ...(choices.length ? ['choice.commit'] : []),
    'notes.write',
  ]
  const minutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE))
  let total = [minutes, Math.max(minutes + 1, Math.ceil(minutes * 1.4))]
  if (typeof data.minutes === 'number') total = [data.minutes, Math.ceil(data.minutes * 1.4)]
  if (Array.isArray(data.minutes) && data.minutes.length === 2) total = data.minutes.map(Number)
  const content = m.content ?? {}
  m.content = {
    rating: String(data.rating ?? content.rating ?? 'everyone'),
    warnings: (data.warnings ?? content.warnings ?? []).map(String),
    estimatedMinutes: typeof data.minutes !== 'undefined' || !content.estimatedMinutes
      ? { firstSession: Math.min(total[0], 15), total }
      : content.estimatedMinutes,
  }
  // the Quick Book runtime delivers every one of these; see themes/runtime.js
  m.accessibility = { keyboard: true, screenReader: true, reducedMotion: true, captions: true, untimedMode: true, nonAudioAlternative: true }
  m.offline = { eligible: true, required: ['index.html'], optional: [], maxBytes: m.offline?.maxBytes ?? 5 * 1024 * 1024 }
  m.checkpoints = chapters.map((c) => ({ id: c.id, label: c.title.replace(/[*_`]/g, '').slice(0, 120), order: c.order }))
  m.items = items
  m.achievements = achievements
  m.choices = choices.map(({ line, ...c }) => c)
  m.endings = endings
  m.build = { ...(m.build ?? {}), quickbook: { ...(m.build?.quickbook ?? {}), theme: themeName } }

  /* ── document ───────────────────────────────────────────────────── */
  const kicker = String(data.kicker ?? 'Chapter')
  const bookData = {
    storyId: m.storyId, title, theme: themeName, kicker,
    chapters: chapters.map((c) => ({ id: c.id, title: c.title.replace(/[*_`]/g, ''), order: c.order })),
  }
  const json = JSON.stringify(bookData).replace(/</g, '\\u003c')
  const theme = THEMES[themeName] ?? THEMES[DEFAULT_THEME]
  const est = m.content.estimatedMinutes.total

  const articles = chapters.map((c, i) => {
    const prev = chapters[i - 1]
    const next = chapters[i + 1]
    return `<article class="qb-chapter" id="ch-${attr(c.id)}" data-cp="${attr(c.id)}" aria-labelledby="h-${attr(c.id)}" hidden>
<header class="qb-chapter-head"><p class="qb-kicker">${escapeHtml(kicker)} ${i + 1} of ${chapters.length}</p><h2 id="h-${attr(c.id)}" tabindex="-1">${renderInline(c.title)}</h2></header>
<div class="qb-prose">
${chapterHtml[i]}
</div>
<footer class="qb-chapter-foot">
<div class="qb-tools"><button type="button" class="qb-link" data-action="bookmark">Bookmark this chapter</button><button type="button" class="qb-link" data-action="note" aria-expanded="false">Write a note</button></div>
<form class="qb-note-form" hidden><label for="qb-note-${attr(c.id)}">Your note on “${escapeHtml(c.title)}”</label><textarea id="qb-note-${attr(c.id)}" rows="3" maxlength="2000"></textarea><p><button type="submit" class="qb-btn">Save note</button> <button type="button" class="qb-link" data-action="note-cancel">Cancel</button></p></form>
<nav class="qb-pager" aria-label="Chapter navigation">${prev ? `<button type="button" class="qb-link" data-go="${attr(prev.id)}">← Back</button>` : '<span></span>'}${next ? `<button type="button" class="qb-btn qb-next" data-go="${attr(next.id)}">Continue →</button>` : ''}</nav>
</footer>
</article>`
  }).join('\n')

  const html = `<!DOCTYPE html>
<html lang="${attr(language)}" data-theme="${attr(themeName)}" data-motion="full">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
${themeCss(themeName)}
</style>
</head>
<body>
<a class="qb-skip" href="#qb-main">Skip to the text</a>
<div class="qb-atmosphere" aria-hidden="true"><i></i><i></i><i></i></div>
<header class="qb-top">
<p class="qb-booktitle">${escapeHtml(title)}</p>
<nav class="qb-toc" aria-label="Contents"><button type="button" class="qb-link" id="qb-toc-btn" aria-expanded="false" aria-controls="qb-toc-list">Contents</button><ol id="qb-toc-list" hidden>${chapters.map((c, i) => `<li><button type="button" data-go="${attr(c.id)}" data-label="${attr(c.title.replace(/[*_`]/g, ''))}" disabled>${escapeHtml(kicker)} ${i + 1}</button></li>`).join('')}</ol></nav>
</header>
<main id="qb-main" tabindex="-1">
<section class="qb-cover" id="qb-cover" aria-labelledby="qb-title">
${m.tagline ? `<p class="qb-kicker">${escapeHtml(m.tagline)}</p>` : ''}<h1 id="qb-title">${escapeHtml(title)}</h1>
${introHtml ? `<div class="qb-epigraph">${introHtml}</div>` : ''}
<p><button type="button" class="qb-btn qb-begin" data-go="${attr(chapters[0]?.id ?? '')}">Begin reading</button></p>
<p class="qb-meta">${chapters.length} ${chapters.length === 1 ? 'chapter' : 'chapters'} · about ${est[0]}–${est[1]} minutes · untimed</p>
</section>
${articles}
</main>
<div class="qb-toast" id="qb-toast" role="status" aria-live="polite"></div>
<script type="application/json" id="qb-data">${json}</script>
<!-- storyframe:sdk -->
<script>
${QUICKBOOK_RUNTIME}${theme.js ? '\n' + theme.js : ''}
</script>
</body>
</html>
`
  return {
    html, manifest: m, errors, warnings,
    stats: { words, chapters: chapters.length, items: items.length, achievements: achievements.length, choices: choices.length, endings: endings.length, theme: themeName },
  }
}

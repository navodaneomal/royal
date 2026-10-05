/**
 * Linked books (ADR-0014) — books that live on another site.
 *
 * Storyframe keeps the card (title, cover, notes, rating), publishes it as an
 * immutable release like any other book, and opens the link when a reader
 * taps it: in a new tab (always works), or inside the app's reader for sites
 * built to be embedded (Google Drive/Docs previews, YouTube/Vimeo, flipbook
 * hosts). Pure helpers — no I/O, no DOM.
 */
export const LINK_KINDS = ['web', 'pdf', 'epub', 'flipbook', 'audio', 'video', 'other']
export const LINK_OPEN = ['tab', 'embed']

const FLIPBOOK_HOSTS = /(^|\.)(heyzine\.com|anyflip\.com|fliphtml5\.com|flipsnack\.com|issuu\.com|publuu\.com|flipbookpdf\.net|yumpu\.com|calameo\.com|simplebooklet\.com)$/i
const isLocal = (host) => /^(localhost|127\.0\.0\.1)$/i.test(host)

/** May this URL be a linked book at all? https only (http only for localhost dev). */
export function isAllowedLinkUrl(url) {
  try {
    const u = new URL(url)
    if (u.username || u.password) return false
    return u.protocol === 'https:' || (u.protocol === 'http:' && isLocal(u.hostname))
  } catch { return false }
}

/**
 * Understand what an author pasted: fix the scheme, recognise the host, and
 * turn share links into their embeddable form where the host offers one.
 * @returns {{ ok:true, url:string, original:string, host:string, kind:string, open:'tab'|'embed', embeddable:boolean, note:string }
 *          | { ok:false, error:string }}
 */
export function smartLink(input) {
  let raw = String(input ?? '').trim()
  if (!raw) return { ok: false, error: 'Paste the address of the book.' }
  if (/^(javascript|data|vbscript|file|blob):/i.test(raw)) return { ok: false, error: 'Only web addresses (https://…) can be linked.' }
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = 'https://' + raw.replace(/^\/+/, '')
  let u
  try { u = new URL(raw) } catch { return { ok: false, error: 'That does not look like a web address.' } }
  if (u.protocol === 'http:' && !isLocal(u.hostname)) u.protocol = 'https:'
  if (!isAllowedLinkUrl(u.href)) return { ok: false, error: 'Only https:// links can be added (and never with a password in them).' }
  const original = u.href
  const host = u.hostname.replace(/^www\./i, '').toLowerCase()
  const path = u.pathname
  const ext = (/\.([a-z0-9]{2,5})$/i.exec(path)?.[1] ?? '').toLowerCase()
  let kind = ext === 'pdf' ? 'pdf' : ext === 'epub' ? 'epub' : /^(mp3|m4a|ogg|wav|aac)$/.test(ext) ? 'audio' : /^(mp4|webm|mov)$/.test(ext) ? 'video' : 'web'
  let open = 'tab'
  let embeddable = false
  let note = ''

  let m
  if (host === 'drive.google.com' && (m = /^\/file\/d\/([\w-]+)/.exec(path))) {
    u = new URL(`https://drive.google.com/file/d/${m[1]}/preview`)
    kind = 'pdf'; open = 'embed'; embeddable = true
    note = 'Google Drive file — shown with Drive’s own viewer. Share it as “Anyone with the link”.'
  } else if (host === 'docs.google.com' && (m = /^\/(document|presentation|spreadsheets)\/d\/([\w-]+)/.exec(path))) {
    u = new URL(`https://docs.google.com/${m[1]}/d/${m[2]}/preview`)
    kind = 'web'; open = 'embed'; embeddable = true
    note = 'Google Docs — shown read-only. Share it as “Anyone with the link”.'
  } else if ((host === 'youtube.com' || host === 'm.youtube.com') && u.searchParams.get('v')) {
    u = new URL(`https://www.youtube-nocookie.com/embed/${encodeURIComponent(u.searchParams.get('v'))}`)
    kind = 'video'; open = 'embed'; embeddable = true; note = 'YouTube — played with the privacy-enhanced player.'
  } else if (host === 'youtu.be' && (m = /^\/([\w-]{6,})/.exec(path))) {
    u = new URL(`https://www.youtube-nocookie.com/embed/${m[1]}`)
    kind = 'video'; open = 'embed'; embeddable = true; note = 'YouTube — played with the privacy-enhanced player.'
  } else if ((host === 'youtube-nocookie.com' || host === 'youtube.com') && (m = /^\/embed\/([\w-]{6,})/.exec(path))) {
    u = new URL(`https://www.youtube-nocookie.com/embed/${m[1]}`)
    kind = 'video'; open = 'embed'; embeddable = true; note = 'YouTube — played with the privacy-enhanced player.'
  } else if (host === 'player.vimeo.com' && /^\/video\/\d+/.test(path)) {
    kind = 'video'; open = 'embed'; embeddable = true
  } else if (host === 'vimeo.com' && (m = /^\/(\d+)/.exec(path))) {
    u = new URL(`https://player.vimeo.com/video/${m[1]}`)
    kind = 'video'; open = 'embed'; embeddable = true
  } else if (FLIPBOOK_HOSTS.test(host)) {
    kind = 'flipbook'; open = 'embed'; embeddable = true; note = 'Flipbook host — built to be shown inside other sites.'
  } else if (host.endsWith('dropbox.com') && /^(pdf|epub)$/.test(ext)) {
    u.searchParams.delete('dl'); u.searchParams.set('raw', '1')
    note = 'Dropbox file — linked directly so it opens instead of downloading.'
  } else if (host === 'gutenberg.org') {
    note = 'Project Gutenberg — opens on their site (they do not allow embedding).'
  }
  return { ok: true, url: u.href, original, host, kind, open, embeddable, note }
}

const HOST_NAMES = { 'youtube-nocookie.com': 'YouTube video', 'youtube.com': 'YouTube video', 'youtu.be': 'YouTube video', 'player.vimeo.com': 'Vimeo video', 'vimeo.com': 'Vimeo video', 'drive.google.com': 'Google Drive file', 'docs.google.com': 'Google Doc' }

/** A display name from a URL when no title was given ("the-lantern-fox.pdf" → "The Lantern Fox"). */
export function titleFromUrl(url) {
  try {
    const u = new URL(url)
    const named = HOST_NAMES[u.hostname.replace(/^www\./, '').toLowerCase()]
    if (named) return named
    const last = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() ?? '')
      .replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[-_+]+/g, ' ').trim()
    const usable = last && !/^\d+$/.test(last) && !/^(preview|view|edit|embed|index)$/i.test(last)
    // no real name in the address → the plain host name (an author can always type a title)
    return usable ? last.replace(/(^|\s)(\p{L})/gu, (m, a, c) => a + c.toUpperCase()).slice(0, 120) : u.hostname.replace(/^www\./, '')
  } catch { return 'Untitled book' }
}

/**
 * The manifest of a linked book: the full schema, so every tool (registry,
 * compat checker, share cards, Studio) treats it like any other release —
 * with one "Opened" checkpoint, no capabilities, and nothing offline.
 */
export function linkedManifest({ storyId, slug, version = '1.0.0', title, tagline = '', synopsis = '', cover = 'cover.svg', accent,
  url, open = 'tab', kind = 'web', author, rating = 'everyone', warnings = [], minutes = [20, 60], language = 'en', accessibility = {} }) {
  const [lo, hi] = Array.isArray(minutes) ? minutes : [minutes, minutes]
  const m = {
    $schema: 'https://storyframe.dev/schemas/storyframe.v1.json',
    storyId, slug, version, protocolVersion: '1.0', stateSchemaVersion: 1,
    title, tagline, synopsis, cover,
    entrypoint: 'storyframe.json',
    languages: [language], defaultLanguage: language,
    capabilities: [],
    content: { rating, warnings, estimatedMinutes: { firstSession: Math.max(1, Number(lo) || 20), total: [Math.max(1, Number(lo) || 20), Math.max(Number(lo) || 20, Number(hi) || 60)] } },
    // what the author can honestly vouch for about the other site; nothing is assumed
    accessibility: { keyboard: false, screenReader: false, reducedMotion: false, captions: false, untimedMode: true, nonAudioAlternative: kind !== 'audio' && kind !== 'video', ...accessibility },
    offline: { eligible: false, required: [], optional: [], maxBytes: 4 * 1024 * 1024 },
    checkpoints: [{ id: 'opened', label: 'Opened', order: 10 }],
    items: [], achievements: [], choices: [], endings: [], migrations: [],
    link: { url, open, kind, ...(author ? { author } : {}) },
    build: { link: {} },
  }
  if (accent) m.accent = accent
  return m
}

/**
 * Bulk import: one book per line — "Title | https://…", "Title, https://…",
 * "Title — Author | https://…", a bare URL, or a CSV with title/url[/author] headers.
 * @returns {{ books: {title:string, url:string, author?:string, line:number}[], errors: string[] }}
 */
export function parseLinkList(text) {
  const books = []
  const errors = []
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n')
  const header = (lines[0] ?? '').toLowerCase()
  const csv = /\burl\b/.test(header) && /\btitle\b/.test(header) && header.includes(',')
  const cols = csv ? header.split(',').map((c) => c.trim()) : []
  lines.forEach((raw, i) => {
    const line = raw.trim()
    if (!line || line.startsWith('#') || (csv && i === 0)) return
    let title = ''
    let url = ''
    let author = ''
    if (csv) {
      const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim()) ?? []
      title = cells[cols.indexOf('title')] ?? ''
      url = cells[cols.indexOf('url')] ?? ''
      author = cols.includes('author') ? cells[cols.indexOf('author')] ?? '' : ''
    } else {
      const found = /(https?:\/\/\S+|(?:www\.)?[\w-]+(?:\.[\w-]+)+\/\S*)\s*$/i.exec(line)
      if (!found) { errors.push(`line ${i + 1}: no web address found`); return }
      url = found[1]
      title = line.slice(0, found.index).replace(/[\s|,;:—–-]+$/, '').trim()
      const by = /^(.*?)\s+(?:—|–|-|by)\s+(.+)$/i.exec(title)
      if (by) { title = by[1].trim(); author = by[2].trim() }
    }
    const s = smartLink(url)
    if (!s.ok) { errors.push(`line ${i + 1}: ${s.error}`); return }
    books.push({ title: (title || titleFromUrl(s.url)).slice(0, 120), url: s.url, ...(author ? { author: author.slice(0, 120) } : {}), line: i + 1 })
  })
  return { books, errors }
}

/** Origins of embedded linked books in a registry — the app CSP's frame-src allowlist. */
export function linkedFrameOrigins(registry, { max = 30 } = {}) {
  const origins = new Set()
  for (const story of registry?.stories ?? []) {
    for (const rel of story.releases ?? []) {
      const link = rel.link ?? rel.meta?.link
      if (link?.open !== 'embed' || !isAllowedLinkUrl(link.url)) continue
      origins.add(new URL(link.url).origin)
    }
  }
  return [...origins].sort().slice(0, max)
}

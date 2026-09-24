/**
 * .docx → Quick Book Markdown. The Admin Studio runs mammoth in the browser
 * (docx → semantic HTML); this pure function turns that small, predictable
 * HTML vocabulary into Quick Book Markdown and pulls embedded images out
 * into assets/. Headings map: Heading 1 → "#" (title), Heading 2 → "##"
 * (chapters). Documents that use Heading 1 for chapters are detected and
 * shifted down one level.
 */
import { fromBase64 } from './files.js'

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' }
const decode = (s) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)

function inline(html) {
  return decode(html
    .replace(/<br\s*\/?>/gi, '  \n')
    .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, t) => (t.trim() ? `**${t.trim()}**` : ''))
    .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, t) => (t.trim() ? `*${t.trim()}*` : ''))
    .replace(/<a\b[^>]*href="(#[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    .replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1')
    .replace(/<[^>]+>/g, ''))
    .replace(/[ \t]+/g, ' ')
    .trim()
}

/**
 * @param {string} html   mammoth.convertToHtml(...).value
 * @param {{ title?:string }} [opts]
 * @returns {{ markdown:string, assets:Map<string,Uint8Array>, warnings:string[] }}
 */
export function htmlToQuickBookMarkdown(html, opts = {}) {
  const assets = new Map()
  const warnings = []
  let imageN = 0
  const h1Count = (html.match(/<h1\b/gi) ?? []).length
  const shift = h1Count > 1 ? 1 : 0          // several Heading 1s ⇒ they are chapters
  const blocks = []

  // block elements with their content, standalone images, and list open/close markers
  const tokens = html.match(/<(h[1-6]|p|li|blockquote|table)\b[^>]*>[\s\S]*?<\/\1>|<img\b[^>]*>|<(ul|ol)\b[^>]*>|<\/(ul|ol)>/gi) ?? []
  let listKind = null
  let listN = 0
  for (const tok of tokens) {
    const open = /^<(ul|ol)\b/i.exec(tok)
    if (open) { listKind = open[1].toLowerCase(); listN = 0; continue }
    if (/^<\/(ul|ol)>/i.test(tok)) { listKind = null; blocks.push(''); continue }
    const tag = /^<([a-z0-9]+)/i.exec(tok)[1].toLowerCase()

    const imgs = [...tok.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0])
    for (const img of imgs) {
      const src = /src="data:([^;]+);base64,([^"]+)"/i.exec(img)
      const alt = decode(/alt="([^"]*)"/i.exec(img)?.[1] ?? '').trim()
      if (!src) { warnings.push('an image without embedded data was skipped'); continue }
      const ext = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg' })[src[1]] ?? 'png'
      const name = `assets/image-${++imageN}.${ext}`
      assets.set(name, fromBase64(src[2]))
      if (!alt) warnings.push(`${name} has no alt text in the document — add a description before publishing`)
      blocks.push(`![${alt}](${name})`, '')
    }
    if (tag === 'img') continue
    const body = tok.replace(/<img\b[^>]*>/gi, '')

    if (/^h[1-6]$/.test(tag)) {
      const level = Math.min(6, Number(tag[1]) + shift)
      const text = inline(body)
      if (text) blocks.push(`${'#'.repeat(level)} ${text}`, '')
    } else if (tag === 'li') {
      listN += 1
      const text = inline(body)
      if (text) blocks.push(`${listKind === 'ol' ? `${listN}.` : '-'} ${text}`)
    } else if (tag === 'blockquote') {
      const text = inline(body)
      if (text) blocks.push(text.split('\n').map((l) => `> ${l}`).join('\n'), '')
    } else if (tag === 'table') {
      warnings.push('a table was flattened into paragraphs (Quick Books have no tables)')
      for (const cell of body.match(/<t[dh]\b[\s\S]*?<\/t[dh]>/gi) ?? []) { const t = inline(cell); if (t) blocks.push(t, '') }
    } else {
      const text = inline(body)
      if (/^(\*\s*){3}$|^[-–—]{3,}$|^⁂$/.test(text)) blocks.push('---', '')
      else if (text) blocks.push(text, '')
    }
  }

  let markdown = blocks.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
  if (!/^#\s/m.test(markdown) && opts.title) markdown = `# ${opts.title}\n\n` + markdown
  if (!/^##\s/m.test(markdown)) {
    warnings.push('no chapter headings found — the whole document became one chapter; use Heading 2 for chapters')
    markdown = markdown.replace(/^(#\s.*\n)?/, (m) => `${m}\n## Chapter One {#chapter-one}\n\n`)
  }
  return { markdown, assets, warnings }
}

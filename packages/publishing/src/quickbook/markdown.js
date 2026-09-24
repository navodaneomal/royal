/**
 * Quick Book Markdown — a small, SAFE dialect. Every character of author text
 * is HTML-escaped; there is no raw-HTML passthrough, so a pasted book can
 * never inject script into its own package.
 *
 * Blocks:  # title · ## chapter {#id} · ### heading · paragraphs · > quotes ·
 *          - / 1. lists · --- scene breaks · ![alt](assets/x.webp "caption") ·
 *          ``` code ```
 * Directives (container — closed by a line that is exactly `:::`):
 *   :::secret{id="…" name="…" alt="…" hint="…" description="…"}
 *   :::choice{id="…" label="…"}   with option lines "- option-id: Label"
 *   :::branch{choice="…" option="…"}
 *   :::ending{id="…" name="…"}
 * Leaf directive (one line):
 *   ::achievement{id="…" name="…" description="…" secret}
 */

export const escapeHtml = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

export function slugify(text, fallback = 'section') {
  const s = String(text).normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '')
  return s || fallback
}

/** `{id="x" name='A b' secret hint=foo #anchor}` → { id:'x', name:'A b', secret:true, hint:'foo' } */
export function parseAttrs(src) {
  const out = {}
  if (!src) return out
  const body = src.trim().replace(/^\{/, '').replace(/\}$/, '')
  const re = /#([\w-]+)|([A-Za-z_][\w-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s}]+)))?/g
  let m
  while ((m = re.exec(body))) {
    if (m[1]) { out.id = m[1]; continue }
    const value = m[3] ?? m[4] ?? m[5]
    out[m[2]] = value === undefined ? true : value
  }
  return out
}

/* ── inline ────────────────────────────────────────────────────────── */
/**
 * Render inline Markdown to escaped HTML.
 * @param {string} text
 * @param {(msg:string)=>void} warn
 */
export function renderInline(text, warn = () => {}) {
  const codes = []
  let s = String(text).replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000` })
  s = escapeHtml(s)
  // links: internal anchors only; anything else keeps its words, loses its URL
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
    if (/^#[\w-]+$/.test(href)) return `<a href="${href}" class="qb-xref">${label}</a>`
    warn(`link to ${href.replace(/&amp;/g, '&')} kept as plain text — books cannot link to other sites`)
    return label
  })
  s = s.replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_, a, b) => `<strong>${a ?? b}</strong>`)
  s = s.replace(/(^|[^\w*])\*([^*\s][^*]*?)\*(?!\w)|(^|[^\w])_([^_\s][^_]*?)_(?!\w)/g,
    (_, p1, a, p2, b) => `${p1 ?? p2 ?? ''}<em>${a ?? b}</em>`)
  s = s.replace(/ {2,}\n|\\\n/g, '<br>')
  s = s.replace(/\n/g, ' ')
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${escapeHtml(codes[Number(i)])}</code>`)
  return s
}

/* ── blocks ────────────────────────────────────────────────────────── */
/**
 * Parse the body (front matter already removed) into a document tree.
 * @param {string} body
 * @param {number} lineOffset 1-based line number of body line 0 in the file
 */
export function parseBook(body, lineOffset = 1) {
  const errors = []
  const warnings = []
  const doc = { title: null, intro: [], chapters: [] }
  const lines = body.split(/\r?\n/)
  let target = doc.intro                   // where top-level blocks go right now
  const stack = []                         // open container directives
  let para = null                          // { lines, line }
  let list = null                          // { ordered, items, line }
  let quote = null                         // { lines, line }
  let fence = null                         // { lang, lines, line }

  const here = () => (stack.length ? stack[stack.length - 1].children : target)
  const flush = () => {
    if (para) { here().push({ type: 'p', text: para.lines.join('\n'), line: para.line }); para = null }
    if (list) { here().push({ type: 'list', ordered: list.ordered, items: list.items, line: list.line }); list = null }
    if (quote) { here().push({ type: 'quote', text: quote.lines.join('\n'), line: quote.line }); quote = null }
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const line = lineOffset + i
    const t = raw.trim()

    if (fence) {
      if (/^```\s*$/.test(t)) { here().push({ type: 'code', text: fence.lines.join('\n'), line: fence.line }); fence = null }
      else fence.lines.push(raw)
      continue
    }
    if (/^```/.test(t)) { flush(); fence = { lines: [], line }; continue }

    if (/^:::\s*$/.test(t)) {
      flush()
      if (!stack.length) errors.push(`line ${line}: ":::" closes nothing`)
      else stack.pop()
      continue
    }
    const dir = /^(:{2,3})([a-z][\w-]*)\s*(\{.*\})?\s*$/i.exec(t)
    if (dir) {
      flush()
      const node = { type: 'directive', name: dir[2].toLowerCase(), attrs: parseAttrs(dir[3]), children: [], line }
      here().push(node)
      if (dir[1] === ':::') {
        if (node.name === 'achievement') {
          // tolerate :::achievement{…} immediately closed by :::
          if (lines[i + 1]?.trim() === ':::') i += 1
          else errors.push(`line ${line}: achievements are one-line — write ::achievement{…}`)
        } else stack.push(node)
      }
      continue
    }

    const h = /^(#{1,6})\s+(.*?)\s*(\{[^}]*\})?\s*$/.exec(t)
    if (h) {
      flush()
      const level = h[1].length
      const attrs = parseAttrs(h[3])
      if (level === 1) {
        if (stack.length || doc.chapters.length) errors.push(`line ${line}: "# ${h[2]}" — only the book title uses a single #`)
        else doc.title = h[2]
        continue
      }
      if (level === 2) {
        if (stack.length) { errors.push(`line ${line}: chapter "${h[2]}" starts inside an open ::: block (missing ":::"?)`); stack.length = 0 }
        const chapter = { title: h[2], explicitId: attrs.id ?? null, blocks: [], line }
        doc.chapters.push(chapter)
        target = chapter.blocks
        continue
      }
      here().push({ type: 'h', level: Math.min(level + 1, 6), text: h[2], line })
      continue
    }

    if (!t) { flush(); continue }
    if (/^(-{3,}|\*{3,}|(\*\s){2,}\*)$/.test(t)) { flush(); here().push({ type: 'hr', line }); continue }

    const img = /^!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"([^"]*)")?\s*\)$/.exec(t)
    if (img) { flush(); here().push({ type: 'image', alt: img[1].trim(), src: img[2], caption: img[3] ?? '', line }); continue }

    const q = /^>\s?(.*)$/.exec(t)
    if (q) {
      if (para || list) flush()
      if (!quote) quote = { lines: [], line }
      quote.lines.push(q[1])
      continue
    }
    const li = /^([-*+]|\d+[.)])\s+(.*)$/.exec(t)
    if (li) {
      if (para || quote) flush()
      const ordered = /\d/.test(li[1])
      if (list && list.ordered !== ordered) flush()
      if (!list) list = { ordered, items: [], line }
      list.items.push({ text: li[2], line })
      continue
    }
    if (list && /^\s{2,}\S/.test(raw)) { list.items[list.items.length - 1].text += ' ' + t; continue }
    if (list || quote) flush()
    if (!para) para = { lines: [], line }
    para.lines.push(raw.replace(/^\s+/, ''))
  }
  flush()
  if (fence) errors.push(`line ${fence.line}: code block never closed with \`\`\``)
  for (const open of stack) errors.push(`line ${open.line}: :::${open.name} is never closed — add a line with only ":::"`)
  return { doc, errors, warnings }
}

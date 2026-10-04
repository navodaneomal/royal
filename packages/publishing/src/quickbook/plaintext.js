/**
 * Plain text → Quick Book Markdown, for authors who write in anything.
 *
 * Recognises the way manuscripts are actually typed:
 *   - a short first line followed by a blank line is the title
 *   - "Chapter 1", "CHAPTER TWO: The Storm", "Part III", "Book One",
 *     "Prologue", "Epilogue", "Interlude", a lone roman numeral ("IV") or
 *     number ("12.") on its own line start a chapter
 *   - "***", "* * *", "---", "#" alone are scene breaks
 * Text that already has Markdown chapter headings (## …) is left alone.
 * Lines that would accidentally read as Markdown/directives are escaped.
 */
const WORD_NUM = 'one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty'
const CHAPTER_RE = new RegExp(
  `^(?:(chapter|part|book|act|section)\\s+(?:\\d{1,3}|[ivxlcdm]{1,7}|(?:${WORD_NUM})(?:[\\s-](?:${WORD_NUM}))?)\\b[.:\\-–—]?(?:\\s+.*)?|(prologue|epilogue|interlude|afterword|foreword)\\b[.:\\-–—]?(?:\\s+.*)?)$`,
  'i',
)
const LONE_NUMERAL_RE = /^(?:[IVXLC]{1,7}|\d{1,3})\.?$/
const SCENE_BREAK_RE = /^(?:\*\s*\*\s*\*|-{3,}|#|~{3,}|•\s*•\s*•)$/

/** Title-case shouting: an ALL CAPS heading, or an ALL CAPS label before ":" ("CHAPTER TWO: Downstream").
    Roman numerals after a chapter word stay upper-case ("PART IV" → "Part IV"). */
const titleCase = (s) => s.toLowerCase().replace(/(^|[\s:—–-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase())
const romanAfterKeyword = (s) => s.replace(/^((?:chapter|part|book|act|section)\s+)([ivxlcdm]{1,7})\b/i, (m, k, n) => k + n.toUpperCase())
const tidy = (line) => {
  if (line === line.toUpperCase() && /[A-Z]/.test(line)) return romanAfterKeyword(titleCase(line))
  return line.replace(/^([^:.–—]+?)(?=\s*[:.–—])/, (label) => (label === label.toUpperCase() && /[A-Z]{2}/.test(label) ? romanAfterKeyword(titleCase(label)) : label))
}

export function textToQuickBookMarkdown(text, { title } = {}) {
  const src = String(text ?? '').replace(/\r\n?/g, '\n').replace(/\t/g, '    ').replace(/[  ]+$/gm, '')
  if (/^##\s+\S/m.test(src)) {
    return { markdown: src, title: (/^#\s+(.+)$/m.exec(src)?.[1] ?? title ?? '').trim(), chapters: (src.match(/^##\s+/gm) ?? []).length, converted: false }
  }
  const lines = src.split('\n')
  let i = 0
  while (i < lines.length && !lines[i].trim()) i++

  // a short first line followed by a blank line reads as the title
  let bookTitle = title ?? ''
  const first = (lines[i] ?? '').trim()
  const moreAfter = lines.slice(i + 1).some((l) => l.trim())
  if (first && first.length <= 80 && moreAfter && !CHAPTER_RE.test(first) && !(lines[i + 1] ?? '').trim()) {
    if (!bookTitle) bookTitle = tidy(first.replace(/^#\s*/, ''))
    i++
  }

  const out = []
  let chapters = 0
  for (; i < lines.length; i++) {
    const raw = lines[i]
    const line = raw.trim()
    const blankAround = !(lines[i - 1] ?? '').trim() && !(lines[i + 1] ?? '').trim()
    if (line && line.length <= 90 && CHAPTER_RE.test(line)) {
      out.push('', `## ${tidy(line)}`, ''); chapters++; continue
    }
    if (line && blankAround && LONE_NUMERAL_RE.test(line)) {
      out.push('', `## ${line.replace(/\.$/, '')}`, ''); chapters++; continue
    }
    if (line && blankAround && SCENE_BREAK_RE.test(line)) { out.push('', '---', ''); continue }
    // keep plain text plain: escape starts that Markdown or a directive would claim
    out.push(raw.replace(/^(\s*)(#{1,6}\s|:::|::|>|[-+*]\s|\d+[.)]\s|!\[)/, (m, sp, tok) => sp + '\\' + tok))
  }

  let body = out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  if (!chapters) { body = `## ${bookTitle ? 'The story' : 'Chapter 1'}\n\n${body}`; chapters = 1 }
  const heading = bookTitle ? `# ${bookTitle}\n\n` : ''
  return { markdown: heading + body + '\n', title: bookTitle, chapters, converted: true }
}

/**
 * Reader-facing release notes. CHANGELOG.md sections start with
 * "## 1.2.0" (optionally "## 1.2.0 — 2026-09-01" or "## [1.2.0]").
 * Returns the section for `version`, else the newest section, capped.
 */
export function extractReleaseNotes(markdown, version, maxChars = 4000) {
  if (!markdown) return ''
  const lines = String(markdown).replace(/\r/g, '').split('\n')
  const sections = []
  let cur = null
  for (const line of lines) {
    const h = /^##\s+\[?v?(\d+\.\d+\.\d+)\]?/.exec(line)
    if (h) { cur = { version: h[1], lines: [] }; sections.push(cur); continue }
    if (/^#\s/.test(line)) continue
    if (cur) cur.lines.push(line)
  }
  const pick = sections.find((s) => s.version === version) ?? sections[0]
  const text = (pick ? pick.lines.join('\n') : lines.filter((l) => !/^#\s/.test(l)).join('\n')).trim()
  return text.length > maxChars ? text.slice(0, maxChars - 1) + '…' : text
}

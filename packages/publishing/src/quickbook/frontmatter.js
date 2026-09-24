/**
 * Front matter for Quick Books — a deliberately tiny YAML subset:
 *   key: value            strings (quoted or bare), numbers, true/false
 *   key: [a, "b c", 3]    inline lists
 *   key:                  block lists
 *     - a
 *     - b
 * Anything richer belongs in storyframe.json.
 */
function scalar(raw) {
  const v = raw.trim()
  if (v === '') return ''
  if (/^(true|false)$/i.test(v)) return v.toLowerCase() === 'true'
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v)
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1)
  return v
}

function inlineList(raw) {
  const inner = raw.trim().slice(1, -1)
  const out = []
  let cur = ''
  let quote = null
  for (const ch of inner) {
    if (quote) { if (ch === quote) quote = null; cur += ch; continue }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue }
    if (ch === ',') { if (cur.trim()) out.push(scalar(cur)); cur = ''; continue }
    cur += ch
  }
  if (cur.trim()) out.push(scalar(cur))
  return out
}

/** @returns {{ data: object, body: string, bodyLine: number, errors: string[] }} bodyLine is 1-based */
export function parseFrontMatter(text) {
  const src = text.replace(/^﻿/, '')
  const errors = []
  if (!/^---\s*\r?\n/.test(src)) return { data: {}, body: src, bodyLine: 1, errors }
  const lines = src.split(/\r?\n/)
  const end = lines.findIndex((l, i) => i > 0 && /^---\s*$/.test(l))
  if (end < 0) return { data: {}, body: src, bodyLine: 1, errors: ['front matter opened with --- but never closed'] }
  const data = {}
  let listKey = null
  for (let i = 1; i < end; i++) {
    const line = lines[i]
    if (!line.trim() || line.trim().startsWith('#')) continue
    const item = /^\s+-\s+(.*)$/.exec(line)
    if (item && listKey) { data[listKey].push(scalar(item[1])); continue }
    const kv = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(line)
    if (!kv) { errors.push(`front matter line ${i + 1} is not "key: value"`); continue }
    const [, key, value] = kv
    if (value.trim() === '') { data[key] = []; listKey = key; continue }
    listKey = null
    data[key] = value.trim().startsWith('[') && value.trim().endsWith(']') ? inlineList(value) : scalar(value)
  }
  return { data, body: lines.slice(end + 1).join('\n'), bodyLine: end + 2, errors }
}

/** Serialise flat front matter (used by the Admin Studio when it rewrites book.md). */
export function stringifyFrontMatter(data) {
  const q = (v) => (typeof v === 'string' && (/[:#\[\],]|^\s|\s$/.test(v) || v === '') ? JSON.stringify(v) : String(v))
  const lines = Object.entries(data).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) =>
    Array.isArray(v) ? `${k}: [${v.map(q).join(', ')}]` : `${k}: ${q(v)}`)
  return lines.length ? `---\n${lines.join('\n')}\n---\n` : ''
}

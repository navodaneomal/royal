/**
 * In-memory file maps — the one currency every publishing function trades in.
 * A "file map" is `Map<string, Uint8Array>` keyed by forward-slash paths
 * relative to a root (a story folder, or a package). Node code fills it from
 * disk; the browser fills it from a dropped zip. Nothing here touches I/O.
 */
const enc = new TextEncoder()
const dec = new TextDecoder('utf-8', { fatal: false })

export const toBytes = (value) => (typeof value === 'string' ? enc.encode(value) : value)
export const toText = (bytes) => (typeof bytes === 'string' ? bytes : dec.decode(bytes))

export const TEXT_EXTENSIONS = new Set(['html', 'htm', 'js', 'mjs', 'css', 'json', 'svg', 'md', 'txt', 'xml'])
export const extOf = (path) => (/\.([a-z0-9]+)$/i.exec(path)?.[1] ?? '').toLowerCase()
export const isTextPath = (path) => TEXT_EXTENSIONS.has(extOf(path))

export const MIME = {
  svg: 'image/svg+xml', png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', avif: 'image/avif', woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf',
  mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4', mp4: 'video/mp4', webm: 'video/webm',
  vtt: 'text/vtt', html: 'text/html', css: 'text/css', js: 'text/javascript', json: 'application/json',
}

/**
 * Normalise a path inside a file map. Returns null for anything that would
 * escape the root (`..`, absolute paths, drive letters, NUL) — the builder and
 * validator refuse such paths instead of resolving them.
 */
export function normalizePath(path) {
  if (typeof path !== 'string' || !path || path.includes('\0')) return null
  let p = path.replace(/\\/g, '/').replace(/^\.\//, '')
  if (p.startsWith('/') || /^[a-z]:/i.test(p)) return null
  const out = []
  for (const part of p.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') {
      if (!out.length) return null          // would escape the root
      out.pop()
      continue
    }
    out.push(part)
  }
  return out.length ? out.join('/') : null
}

/** true for refs the builder must leave alone: data:, blob:, http(s):, //host, #frag, mailto: … */
export const isForeignRef = (ref) => /^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith('//') || ref.startsWith('#')

/** Resolve `ref` (as written in `fromFile`) against the root of the file map. */
export function resolveRef(fromFile, ref) {
  const clean = ref.split('#')[0].split('?')[0]
  if (!clean || /^[a-z][a-z0-9+.-]*:/i.test(clean) || clean.startsWith('//')) return null // data:, http:, blob:…
  const baseDir = fromFile.includes('/') ? fromFile.slice(0, fromFile.lastIndexOf('/') + 1) : ''
  const joined = clean.startsWith('/') ? clean.slice(1) : baseDir + clean
  return normalizePath(joined)
}

/** Keep only the files under `prefix/`, re-rooted. */
export function subMap(files, prefix) {
  const p = prefix.replace(/\/+$/, '') + '/'
  const out = new Map()
  for (const [path, bytes] of files) if (path.startsWith(p)) out.set(path.slice(p.length), bytes)
  return out
}

export const totalBytes = (files) => [...files.values()].reduce((n, b) => n + b.byteLength, 0)

/** base64 without Buffer (browser + Node). */
export function toBase64(bytes) {
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK))
  return btoa(bin)
}
export function fromBase64(b64) {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export const formatBytes = (n) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`

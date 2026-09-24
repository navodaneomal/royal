/* Zip in / zip out, in the browser (fflate — small, no workers needed). */
import { unzipSync, zipSync } from 'fflate'

const JUNK = /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db|desktop\.ini|\.git)(\/|$)/

/** Unzip to a file map; strips a single shared top-level folder (common when zipping a folder). */
export function unzipToMap(bytes: Uint8Array): Map<string, Uint8Array> {
  const raw = unzipSync(bytes)
  let entries = Object.entries(raw).filter(([p, b]) => !p.endsWith('/') && !JUNK.test(p) && b.byteLength >= 0)
  const tops = new Set(entries.map(([p]) => p.split('/')[0]))
  if (tops.size === 1 && entries.every(([p]) => p.includes('/'))) {
    const prefix = [...tops][0] + '/'
    entries = entries.map(([p, b]) => [p.slice(prefix.length), b])
  }
  return new Map(entries.map(([p, b]) => [p.replace(/\\/g, '/'), b]))
}

export function mapToZip(files: Map<string, Uint8Array>, folder = ''): Uint8Array {
  const obj: Record<string, [Uint8Array, { mtime: Date }]> = {}
  for (const [p, b] of files) obj[(folder ? folder + '/' : '') + p] = [b, { mtime: new Date('2026-01-01T00:00:00Z') }]
  return zipSync(obj, { level: 6 })
}

export function downloadBytes(bytes: Uint8Array, name: string, type = 'application/zip') {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }))
  const a = document.createElement('a')
  a.href = url; a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

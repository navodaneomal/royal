/**
 * Content addressing — pure, so the Admin Studio can predict the release id
 * CI will produce for the exact same bytes (`r` + sha256[:12]).
 */
import { sha256Hex } from './sha256.js'
import { toText, toBytes } from './files.js'

export const RELEASE_PLACEHOLDER = '__SF_RELEASE_ID__'

/** Deterministic package hash over path:hash lines (integrity.json excluded). */
export function packFiles(files) {
  const entries = [...files.entries()]
    .filter(([path]) => path !== 'integrity.json')
    .map(([path, bytes]) => ({ path, hash: sha256Hex(bytes), bytes: bytes.byteLength }))
    .sort((x, y) => (x.path < y.path ? -1 : x.path > y.path ? 1 : 0))
  const packageHash = sha256Hex(entries.map((e) => `${e.path}:${e.hash}`).join('\n'))
  return { entries, packageHash, releaseId: 'r' + packageHash.slice(0, 12) }
}

/**
 * Stamp the release id into the entrypoint and produce the integrity manifest
 * of the STAMPED files — what readers' downloads verify against.
 */
export function stampReleaseFiles(files, { entrypoint, releaseId, packageHash, generatedAt }) {
  const out = new Map(files)
  out.delete('integrity.json')
  const entry = out.get(entrypoint)
  if (entry) out.set(entrypoint, toBytes(toText(entry).replaceAll(RELEASE_PLACEHOLDER, releaseId)))
  const integrityFiles = {}
  for (const path of [...out.keys()].sort()) integrityFiles[path] = 'sha256:' + sha256Hex(out.get(path))
  const integrity = { generatedAt, releaseId, packageHash, files: integrityFiles }
  out.set('integrity.json', toBytes(JSON.stringify(integrity, null, 2)))
  return { files: out, integrity }
}

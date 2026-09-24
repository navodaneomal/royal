/**
 * Plan a one-commit publish of a story folder (Admin Studio → GitHub Git
 * Data API). Pure: given what the branch has under `stories/<slug>/` and what
 * the author is publishing, return exactly which blobs to write and which
 * paths to delete, so the resulting tree mirrors the upload.
 */
import { sha256Hex } from './sha256.js'
import { normalizePath } from './files.js'

/** Git's blob id for bytes: sha1("blob <len>\0" + bytes) — computed by the caller (WebCrypto) when needed. */
export const gitBlobHeader = (length) => `blob ${length}\0`

/**
 * @param {{ slug:string, files:Map<string,Uint8Array>, existing:{path:string, sha?:string}[] }} input
 *   existing: paths currently under stories/<slug>/ on the target branch (repo-relative)
 * @returns {{ prefix:string, upserts:{path:string, bytes:Uint8Array}[], deletes:string[], skipped:string[] }}
 */
export function planStoryCommit({ slug, files, existing = [] }) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('invalid slug: ' + slug)
  const prefix = `stories/${slug}/`
  const upserts = []
  const skipped = []
  for (const [path, bytes] of files) {
    const clean = normalizePath(path)
    // never publish build outputs or executable build scripts into the source tree
    if (!clean || /^package\//.test(clean) || /(^|\/)build-package\.m?js$/.test(clean) || /(^|\/)(\.DS_Store|Thumbs\.db)$/.test(clean) || clean.startsWith('.git/')) {
      skipped.push(path); continue
    }
    upserts.push({ path: prefix + clean, bytes })
  }
  const keep = new Set(upserts.map((u) => u.path))
  const deletes = existing.map((e) => e.path).filter((p) => p.startsWith(prefix) && !keep.has(p) && !/^stories\/[^/]+\/package\//.test(p))
  return { prefix, upserts, deletes, skipped }
}

export const publishCommitMessage = (slug, version) => `publish(${slug}): v${version}`

/** Short content fingerprint of a plan, for idempotent "already published" checks. */
export const planFingerprint = (plan) =>
  sha256Hex(plan.upserts.map((u) => `${u.path}:${sha256Hex(u.bytes)}`).sort().join('\n') + '\n-' + plan.deletes.sort().join('\n')).slice(0, 16)

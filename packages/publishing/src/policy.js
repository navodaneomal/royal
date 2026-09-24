/**
 * The content-security policy every story document runs under.
 *
 * The same policy is delivered twice, on purpose:
 *   - as an HTTP header by the story host (server.mjs, Cloudflare `_headers`);
 *   - as a <meta> tag the declarative builder stamps into every package,
 *     because an offline story plays from a Blob URL in an opaque frame and
 *     a blob document never sees the host's headers. Without the meta tag an
 *     offline package could `fetch()` an obfuscated URL; with it,
 *     `connect-src 'none'` travels with the bytes.
 * `frame-ancestors` is header-only (browsers ignore it in <meta>).
 */
export const STORY_CSP_DIRECTIVES = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline' 'self'",
  "img-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
]
export const STORY_CSP = STORY_CSP_DIRECTIVES.join('; ')
export const STORY_CSP_META = `<meta http-equiv="Content-Security-Policy" content="${STORY_CSP}">`

/** Cloudflare Pages static asset limit (per file). */
export const MAX_FILE_BYTES = 25 * 1024 * 1024
/** Soft guidance: anything bigger than this deserves a second look. */
export const HEAVY_FILE_BYTES = 10 * 1024 * 1024
export const ENTRY_GUIDANCE_BYTES = 500 * 1024
export const COVER_EXTENSIONS = ['svg', 'png', 'webp', 'jpg', 'jpeg']

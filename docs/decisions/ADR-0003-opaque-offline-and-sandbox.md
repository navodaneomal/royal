# ADR-0003 — offline stories as integrity-verified single-file packages in opaque frames (and what the sandbox grants)

**Status:** accepted · **supersedes** the blueprint's assumption that a service
worker can serve offline story routes into the frame

## Context

The blueprint wants offline stories AND hard isolation. Those collide on a platform
fact: a sandboxed iframe **without** `allow-same-origin` has an *opaque origin*, and
opaque-origin documents **are not service-worker clients** — a SW can never serve
their subresources. Keeping `allow-same-origin` for offline (so the SW could serve
them) would hand offline stories the app's origin — storage, cookies, DOM — which is
exactly what the security model forbids.

## Decision

1. **Packages are single-file.** The build inlines everything (SDK, CSS, art, audio
   as data URIs); the validator enforces no external origins and no `fetch`.
2. **Downloads verify before they exist.** The app fetches `integrity.json` + the
   entry file, hashes with WebCrypto, and refuses the download on any mismatch
   (“integrity check FAILED — download discarded”).
3. **Offline playback = Blob URL in an opaque frame.** The verified bytes live in
   IndexedDB; playback creates a Blob URL inside `sandbox="allow-scripts allow-forms"`.
   No SW involvement, no origin granted, works in airplane mode (audited).
4. The app's service worker caches the **app shell only** and is forbidden from
   serving story bytes.

## The sandbox grant, stated precisely

- Online, separate story origin: `allow-scripts allow-same-origin allow-forms` —
  same-origin *with the story host only*, never with the app; exact-origin handshake.
- Opaque (offline, and every same-origin preview): `allow-scripts allow-forms` —
  `self.origin === "null"`, no storage, no cookies, no parent DOM (all three proven
  from inside the frame by `npm run verify`); the wildcard welcome carries no reader
  data.
- **Why `allow-forms`:** text-input stories need real form submission for accessible
  command consoles (labels, implicit submit, AT semantics). It adds no capability a
  script lacks — a sandboxed script can already navigate its own frame — while actual
  exfiltration routes stay closed: publish-time external-origin scan, story-host CSP
  (`connect-src 'none'`), and no secrets in the frame. Discovered the honest way:
  the audit's typed commands were silently eaten until this was granted.

## Consequences

- Offline eligibility constrains authors (single file, size budget) — declared in the
  manifest and enforced by the validator, not discovered by readers.
- Blob URLs are revoked on player teardown; deleting a download never touches
  progress.
- Very large media-heavy stories may need a future chunked-package format; out of
  scope here and noted in STATUS.md.

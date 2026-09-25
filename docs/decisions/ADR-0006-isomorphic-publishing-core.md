# ADR-0006 — One isomorphic publishing core for CLI, CI, and browser

**Status:** accepted (v2)

## Context

v1's release gate lived in `story-cli/lib.mjs`, welded to `node:fs`. The Admin
Studio must run the *identical* gate in the browser, or authors would see
"valid" in the wizard and "rejected" in CI.

## Decision

`packages/publishing` — plain ESM, no I/O, no Node built-ins — owns every
decision: `validatePackage`, the declarative builder, the Quick Book compiler
and themes, `checkCompatibility`, registry operations, `_headers`
generation, cover generation, commit planning, docx import. Its currency is a
file map (`Map<path, Uint8Array>`). The CLI fills the map from disk (symlinks
never followed); the Admin Studio fills it from a dropped zip.

SHA-256 is implemented in plain JS (synchronous, tested against
`node:crypto`), so the browser computes the same content hash — and the same
predicted release id — CI will.

## Consequences

- "Valid in the wizard" means "valid in CI": same function, same bytes.
- The Admin Studio can show the release id before publishing.
- The package is marked `sideEffects: false`; the reader bundle only pays for
  the one helper it uses.
- The Quick Book runtime is a string literal, not a function, so a minifier
  can never make browser-built bytes differ from Node-built bytes.

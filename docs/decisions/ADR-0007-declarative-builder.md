# ADR-0007 — Declarative builds; CI never executes story code

**Status:** accepted (v2)

## Context

Each v1 book shipped a bespoke `build-package.mjs`. Once anyone can upload a
book through the Admin Studio, running uploaded build scripts in CI would
hand them the CI token and the repository.

## Decision

A `build` block in `storyframe.json` with exactly one source mode:
`entry` (an HTML file), `concat` (ordered parts + `@sdk`), `quickbook`
(`book.md` + theme), or `prebuilt` (a finished package folder). The generic
builder inlines relative scripts, styles, images (SVG minified to
percent-encoded data URIs, rasters base64), fonts, and media; strips
external font links; fills the SDK slot; stamps `data-sf-release`; and
stamps the story CSP as a `<meta>` so offline blob copies keep
`connect-src 'none'` (blob documents never see the host's headers).
References that escape the story folder are errors; `build-package.mjs`
files are ignored and reported.

## Consequences

- Both shipped books migrated; their packages are byte-identical to v1's apart
  from the CSP meta tag (diffed during migration).
- The validator now *requires* the CSP meta, closing an exfiltration path
  that existed in v1's offline mode.
- Authors with genuinely exotic build needs use `prebuilt` — they build
  wherever they like and upload the result, which is still validated,
  stamped, and sandboxed.

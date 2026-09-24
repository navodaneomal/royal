# ADR-0004 — plain CSS design tokens for the shell; no Tailwind, no CSS-in-JS

**Status:** accepted

## Context

The shell must be deliberately quiet furniture around loud, self-styled stories, and
the accessibility contract (dark scheme, `more` contrast, text scale, reduced motion)
must be enforceable in one place.

## Decision

One `app.css` with custom-property tokens (`--paper`, `--ink`…`--ink-3`, `--brass`,
`--focus`) and three attribute switches on the root element: `[data-scheme="dark"]`,
`[data-contrast="more"]`, `--text-scale`. Components use tokens only.

## Consequences

- The whole preference contract is ~30 lines of token redefinition; `more` contrast
  is provably complete because it only collapses the ink ramp.
- Contrast is auditable numerically (the audit computes ratios; the muted ink was
  raised to ≥4.5:1 when it measured 3.74).
- No utility-class vocabulary or runtime style engine to keep out of story frames;
  the stories' isolation means their CSS never meets the shell's anyway.
- Cost: hand-rolled responsive rules and discipline about token use — acceptable at
  this component count (~8 KB CSS total, gzipped 2.7 KB).

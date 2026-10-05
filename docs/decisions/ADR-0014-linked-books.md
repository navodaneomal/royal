# ADR-0014 — Linked books: books hosted elsewhere, as first-class cards

**Status:** accepted

## Context

Many authors already host their books somewhere: a website, a PDF on Google
Drive, a flipbook service, a video. Re-uploading them is friction, and
converting a fixed-layout PDF loses what makes it good. What they want is
the shelf: a cover, a title, and "tap it and the book opens".

## Decision

1. **A fifth lane, `link`.** The manifest gains an optional `link`
   (`url`, `open: tab|embed`, `kind`, `author`). A linked book's package is
   only its card — `storyframe.json` + cover — built by the same declarative
   builder (no SDK, no HTML), validated by the same release gate (https-only
   link, cover present, nothing else in the package), content-addressed,
   published to channels, promoted, rolled back, and audited like any book.
   The schema is the full `ManifestSchema` (one "Opened" checkpoint, no
   capabilities, not offline-eligible), so the registry, compat checker,
   share cards, CLI, CI, and Studio needed no special cases beyond the lane.
2. **Opening, safely.** `tab` (default) opens the site with
   `target=_blank rel="noopener noreferrer"`. `embed` shows it in the player
   in a sandboxed frame with **no bridge and no reader data**; a link on the
   app's own origin never gets `allow-same-origin`. The app CSP's `frame-src`
   gains exactly the origins of published embedded links
   (`linkedFrameOrigins(registry)`, applied by `deploy-bundle` and the
   preview server); books kept on a device always open in a tab, because
   their origins are not in that allowlist.
3. **Understanding links.** `smartLink` adds the scheme, upgrades http,
   refuses non-web schemes and credentials, and rewrites share links to
   their embeddable form (Drive/Docs `/preview`, YouTube privacy-enhanced
   player, Vimeo player, Dropbox raw), recognising flipbook hosts.
   `parseLinkList` turns a pasted list or CSV into many cards; the Studio
   publishes them in one commit (`GitHub.publishMany`), and CI accepts a
   comma-separated slug list to put them all live.
4. **Honest progress.** Storyframe cannot see inside another site, so it
   records only what it can — last opened, and a reader-set "finished" — on
   the device, and says so on the book page.

## Consequences

- Any hosted book reaches the shelf in under a minute; a list of fifty in one commit.
- Readers keep one library across native, uploaded, and linked books.
- Embedding depends on the other site allowing it; the UI says which hosts
  are built for it and always offers "Open on <host> ↗".
- On Cloudflare (separate app deploys), a newly embedded origin needs an
  app redeploy; GitHub Pages rebuilds the app with every publish.

# ADR-0012 — GitHub Pages as the one-account host; the app CSP covers blob-frame stories

**Status:** accepted (v2.1)

## Context

ADR-0005 put the content plane on a `content` branch and deployed two
Cloudflare Pages projects. That needs a second account, an API token, and
four repository variables before anything is online. Many authors only have
GitHub.

GitHub Pages serves one origin, under a sub-path (`/<repo>/`), and cannot
send custom HTTP headers. Pushes made with `GITHUB_TOKEN` do not trigger a
branch-based Pages build, so CI must deploy with GitHub's Pages actions.

While enforcing the app CSP in the audit for the first time, a latent bug
surfaced: offline playback and the Admin preview run stories from `blob:`
URLs, and a `blob:` document **inherits the policy of the document that
created it**. The app policy (`script-src 'self'`) therefore blocked every
story's inline scripts in those frames — on Cloudflare too, since `_headers`
sent exactly that policy. The previous audit served no app CSP, so it never
saw it.

## Decision

1. **Base-path agnostic app.** Vite `base: './'`; `config.json`, `sw.js`,
   `stories-host`, the manifest, and icons are relative; the service worker
   matches paths relative to its scope. One build runs at a domain root,
   under `/<repo>/`, and in the Capacitor WebView.
2. **`pages.yml`** builds the single-origin bundle (`deploy-bundle --only
   pages`) from the `content` branch — or from `stories/` before the first
   publish — and deploys it with `upload-pages-artifact` + `deploy-pages`,
   after every successful `publish` run and on app changes. Every story runs
   in the opaque sandbox there; the app CSP ships as a `<meta>` tag.
3. **The app CSP is a superset of what stories need** (inline script and
   style, `data:`/`blob:` media), because blob-frame stories run under app
   CSP ∩ story CSP. The app document has no HTML sinks (no `innerHTML`
   anywhere), so `'unsafe-inline'` gives an attacker nothing to inject
   into; eval, plugins, foreign scripts, and foreign frames stay blocked,
   and the story's own `connect-src 'none'` still applies. A unit test
   keeps the app policy a superset of `STORY_CSP`.
4. **The audit enforces production headers.** `preview.mjs` sends the
   Cloudflare app/story CSP, and can serve a bundle under a sub-path with
   Pages-style 404s; `verify.mjs` runs both modes.
5. **The first content run publishes to production**, so a brand-new
   library is never an empty shelf of beta-only books.

## Consequences

- Hosting needs only GitHub: set Pages to "GitHub Actions", make `main` the
  default branch, run the workflow once (DEPLOY.md §0).
- On Pages, `frame-ancestors` cannot be set (other sites could frame the
  app) and everything is cached for 10 minutes; Cloudflare remains the
  documented upgrade for real headers and separate origins.
- GitHub Pages is not for commercial sites or SaaS; a library that sells
  books should move to Cloudflare (the `content` branch moves with it).

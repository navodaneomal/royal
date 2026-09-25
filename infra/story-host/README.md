# The content plane

`server.mjs` is the **dev/preview** host. In production the content plane is
a Cloudflare Pages project on a **separate origin** from the app — that
separation enables the non-opaque online mode — deployed by CI from the
`content` branch (ADR-0005, `DEPLOY.md`).

`stories-host/` here is a **generated** directory (git-ignored on `main`):
`npm run stories:publish` fills it locally; in CI it is a worktree of the
`content` branch.

## Headers

Generated, never hand-written: `packages/publishing/src/headers.js` produces
the `_headers` file for each Pages project (`scripts/deploy-bundle.mjs`), and
`server.mjs` sends the same story CSP from `packages/publishing/src/policy.js`.

| path | headers |
|---|---|
| `/packages/*` (content-addressed, immutable) | `Cache-Control: public, max-age=31536000, immutable` · the story CSP (+ `frame-ancestors <app origin>` when known) |
| `/registry.json`, `/audit-log.json` (pointers) | `Cache-Control: no-cache` |
| `/*` | `Access-Control-Allow-Origin: <app origin>` (or `*` when several/unknown — the content is public and credential-free) · `X-Content-Type-Options: nosniff` · `Referrer-Policy: no-referrer` |
| `/share/*` | short cache · a script-free CSP (Open Graph pages) |

Story CSP: `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' 'self'; img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self' data:; connect-src 'none'; base-uri 'none'; form-action 'none'`.
The builder also stamps it into every package as a `<meta>`, so an offline
copy playing from a Blob URL (which never sees these headers) is held to the
same policy.

Notes:

- `script-src 'unsafe-inline'` is required because packages are single-file by
  design (ADR-0003); the sandbox + no-external-origins gate + CSP is the actual
  isolation story.
- Each header is set by exactly one matching rule: Cloudflare comma-joins a
  header set twice, which for CSP would mean two policies (tested).
- The dev admin API (`/admin/*`, `x-admin-token`) exists **only** in
  `server.mjs`. On static hosting, operator actions run in CI via
  `workflow_dispatch` (the Admin Studio does this for you).

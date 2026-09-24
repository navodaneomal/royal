# Deploying the content plane

`server.mjs` is the **dev/preview** host. In production the content plane is any
static host on a **separate origin** from the app (e.g. `stories.example.com` vs
`app.example.com`) — that separation is what enables the non-opaque online mode.

Serve `stories-host/` (produced by `npm run stories:publish`) with:

| path | headers |
|---|---|
| `/packages/**`, `/releases/**` (content-addressed, immutable) | `Cache-Control: public, max-age=31536000, immutable` |
| `registry.json`, `audit-log.json` (pointers) | `Cache-Control: no-cache` |
| everything | `Access-Control-Allow-Origin: <app origin>` · `X-Content-Type-Options: nosniff` |
| `*.html` | `Content-Security-Policy: default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' 'self'; img-src 'self' data:; media-src 'self' data:; font-src 'self' data:; connect-src 'none'; base-uri 'none'; form-action 'none'` (same policy `server.mjs` sends) |

Notes:

- `script-src 'unsafe-inline'` is required because packages are single-file by design
  (ADR-0003); the sandbox + no-external-origins gate is the actual isolation story.
- `form-action 'none'` backstops the `allow-forms` sandbox grant: in-frame form
  handlers (which `preventDefault`) work, actual submissions go nowhere.
- The dev admin API (`/admin/*`, `x-admin-token`) exists **only** in `server.mjs`.
  On static hosting, operator actions are the CLI (`storyframe promote|rollback|…`)
  followed by re-uploading `registry.json` + `audit-log.json` — the operator console
  detects the static case and shows the CLI command instead of pretending.

## Cloudflare Pages / Netlify sketch

- Publish directory: `stories-host/`.
- Cloudflare `_headers` / Netlify `_headers` file expressing the table above.
- CI: `npm ci && npm run stories:build && npm run stories:publish` then deploy the
  directory. Promotions in CI are `npm run storyframe -- promote <slug> <releaseId>`
  followed by the same deploy — files never change, only pointers.

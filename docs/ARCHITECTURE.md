# Storyframe architecture (v2)

Storyframe is a story operating system: every book is its own self-contained
interactive world running in a sandboxed frame, while the reader keeps one
library, one accessibility profile, and one continuous memory. The platform
is furniture; the stories are the paintings.

## 1. The three planes

```
┌──────────────────────────────  APPLICATION PLANE  ──────────────────────────────┐
│ apps/web — React PWA, hash-routed, served from its own origin                    │
│   Reader: shelf · story detail · immersive player · archive · offline centre ·   │
│           settings · onboarding · command palette           (i18n catalogue)     │
│   Admin Studio (#/admin, lazy chunk): dashboard · New Book wizard · releases     │
│   Local data plane: IndexedDB (progress, timelines, notes, downloads, drafts)    │
│   Boot: /config.json → { storyOrigin, supabase?, githubRepo? }   (ADR-0008)       │
│ apps/mobile — the same build inside a Capacitor WebView (https://localhost)      │
└───────────────────────────────┬─────────────────────────────────────────────────┘
          sandboxed <iframe> + nonce handshake + private MessagePort (protocol 1.1)
┌───────────────────────────────▼──────────────────────────  CONTENT PLANE  ───────┐
│ Cloudflare Pages "stories" project — a separate origin                           │
│   packages/<slug>/r<sha256[:12]>/  index.html · storyframe.json · cover · integrity│
│   registry.json (channel pointers, per-release metadata) · audit-log.json         │
│   share/<slug>.html|png (Open Graph cards)                                        │
│ Source of truth: the `content` git branch, written only by CI (ADR-0005)          │
└───────────────────────────────┬──────────────────────────────────────────────────┘
          same reducer + schemas (packages/protocol, copied verbatim for Deno)
┌───────────────────────────────▼─────────────────────────────  DATA PLANE  ───────┐
│ Local adapter (default, always on): IndexedDB, guest-first, one transaction per   │
│   commit, idempotency journal, conflict archive, 10-snapshot ring, migrations     │
│ Supabase adapter (optional, config.json): magic link, progress-commit +           │
│   progress-import edge functions → single-transaction RPCs, RLS on every table    │
└──────────────────────────────────────────────────────────────────────────────────┘
```

## 2. Workspaces

| package | runs in | role |
|---|---|---|
| `packages/protocol` | browser · Node · Deno | zod contracts, the pure reducer, `migrateSnapshot`, `planImport` |
| `packages/publishing` | browser · Node · CI | validator, declarative builder, Quick Book compiler + themes, compat checker, registry ops, `_headers`, covers, docx import, commit planning (ADR-0006) |
| `packages/story-sdk` | story frames | `connect()` → handshake → session API (progress, prefs, notes) |
| `packages/bridge-host` | app | the host side of the bridge: nonce, origin, schema, rate, size, sequence, capabilities, negotiation |
| `packages/story-cli` | Node · CI | thin I/O wrapper: `new build validate pack publish compat promote rollback disable enable list doctor` |
| `apps/web` | browser | the reader + Admin Studio |
| `apps/mobile` | Android | Capacitor wrapper (ADR-0010) |
| `infra/story-host` | Node (dev) | local content server with the dev-only `/admin/*` API |
| `supabase/` | Postgres · Deno | migrations with RLS, commit/import RPCs, edge functions |

## 3. Publishing flow

```
 Author ──► Admin Studio (browser)                          ── or ──  CLI on a laptop
            drop .md/.docx/.zip → validate + build + hash     (same @storyframe/publishing)
            → preview (opaque blob frame, real bridge)
            → "Publish to beta": ONE commit to main:stories/<slug>/  (Git Data API, PAT)
                     │
                     ▼
 GitHub Actions  publish.yml  (push on stories/**, or workflow_dispatch from the console)
   npm ci → npm test → sdk:build
   → checkout `content` branch as a worktree at infra/story-host/stories-host
   → scripts/ci/content.mjs  (the real CLI library)
        publish:  build (declarative) → validate → publish → beta      (changed slugs)
        promote:  compatibility gate vs production → pointer moves       (ADR-0011)
        rollback / disable / enable: pointer moves
        every action → audit-log.json (actor = GITHUB_ACTOR)
   → commit + push `content`
   → deploy-bundle --only stories (_headers, share cards) → wrangler pages deploy
                     │
                     ▼
 Cloudflare Pages "stories"  ◄── the app reads registry.json, frames packages,
                                 verifies downloads against integrity.json
```

App code follows a separate path: `app.yml` (push on `apps/**`/`packages/**`)
→ test → typecheck → build → `config.json` + `_headers` → `wrangler pages
deploy` to the "app" project.

## 4. Trust boundaries

| boundary | enforced by |
|---|---|
| story frame ↔ app | `sandbox` (opaque offline/single-origin; `allow-same-origin` only with the *stories* origin online), nonce in the URL fragment, `event.source` identity, exact origin online, schema + size + rate + sequence checks, per-message capabilities, no reader data in a wildcard welcome |
| story frame ↔ network | story CSP `connect-src 'none'` as an HTTP header **and** a `<meta>` stamped by the builder (so offline blob copies carry it); validator scan for external origins and network APIs |
| uploaded book ↔ CI | declarative builder only — no story script ever runs; references outside the story folder are errors; symlinks never followed |
| Admin Studio ↔ GitHub | fine-grained PAT (one repo; Contents RW + Actions RW) in `sessionStorage` only; hidden from nav without it; optional Cloudflare Access in front of the app |
| app ↔ stories origin | app CSP `frame-src`/`connect-src` name the stories origin; stories `_headers` send `frame-ancestors` for the app origin when known |
| reader ↔ cloud | Supabase JWT (magic link, PKCE); clients can only SELECT their own rows (RLS); writes go through edge functions running the shared reducer; service role only inside functions |
| content plane integrity | content-addressed release folders, `integrity.json` of stamped bytes, downloads re-hashed with WebCrypto before acceptance |

## 5. Where each secret lives

| secret | lives in | never in |
|---|---|---|
| GitHub fine-grained PAT (Admin Studio) | the admin's browser tab `sessionStorage` | IndexedDB, localStorage, `config.json`, any story frame, the repo |
| `GITHUB_TOKEN` (CI) | GitHub Actions, per run | anywhere persistent |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | GitHub → Settings → Secrets → Actions | the repo, the app |
| Supabase anon key | `config.json` (public by design; RLS protects data) | — |
| Supabase service role key | Supabase function secrets | the app, the repo, CI |
| dev admin token | `STORYFRAME_ADMIN_TOKEN` env on your machine (`dev-admin` default, dev only) | production |

`resolveConfig` refuses any `config.json` key that looks like a secret.

## 6. Reading, saving, resuming

1. Shelf fetches `registry.json` (cached in IndexedDB for offline boot).
2. Player picks the release for the channel, builds the reducer's manifest
   from **that release's own metadata**, prepares resume (migrating an older
   snapshot as a new revision), and starts the bridge.
3. Every `PROGRESS_COMMIT` runs `commitOperation` in one IndexedDB
   transaction: idempotency → base-revision conflict check (→ archived
   divergence + "Two timelines were found") → migration if needed → reducer
   → backups ring → checkpoint ledger (replay points) → archive/achievements.
4. With cloud sync on, the accepted operation is pushed to `progress-commit`;
   a stale push returns 409 and the other device's snapshot is archived for
   the reader to choose.
5. Offline: `integrity.json` + entry re-hashed → Blob in IndexedDB → Blob URL
   in an opaque frame. The service worker never serves story bytes.

## 7. Decision records

ADR-0001 workspaces · 0002 local data plane · 0003 opaque offline + sandbox ·
0004 plain CSS · **0005 Git as the CMS · 0006 isomorphic publishing core ·
0007 declarative builder · 0008 runtime config · 0009 protocol 1.1 ·
0010 Capacitor Android · 0011 compatibility gate + migrations**.

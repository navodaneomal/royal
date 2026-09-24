# Storyframe v2 — plan

Written after reading every file listed in the upgrade brief, before changing code.
It records what v1 actually is, what v2 changes, and the order the work lands in.

## 1. What I found (v1 as shipped)

**Solid, keep as-is**

- `packages/protocol` — zod contracts + one pure reducer (`applyMutation`, `unionMerge`),
  imported by the app, the CLI, and (as a byte-identical copy) the edge function.
- `packages/bridge-host` / `packages/story-sdk` — nonce-in-fragment handshake, private
  `MessagePort`, rate limit, byte cap, monotonic sequence, per-message capability checks.
  Opaque mode never puts reader data in the wildcard welcome.
- `apps/web` — hash-routed React PWA, IndexedDB data plane with the full commit algorithm
  inside one transaction, integrity-verified downloads, blob playback in opaque frames.
- Release model — content-addressed `r<sha256[:12]>` folders + `integrity.json`, pointer
  channels in `registry.json`, append-only `audit-log.json`.

**Broken or fragile (confirmed by reading and by running)**

| where | problem |
|---|---|
| `story-cli/src/lib.mjs` | `REPO = resolve(new URL(...).pathname)` → `/C:/...` and `%20` on Windows |
| `scripts/dev.mjs` | `spawn('npm', …)` fails on Windows (needs `npm.cmd` / a shell) |
| `verify.mjs` | imports Playwright from `/home/claude/.npm-global/...` — only works on one machine |
| `story-cli/src/lib.mjs` | `publishStory` hard-codes `cover.svg` |
| `story-cli/src/lib.mjs` | validator is welded to `node:fs` — the browser cannot run the same gate |
| `story-cli/src/lib.mjs` | per-asset cap is 10 MB, but nothing enforces Cloudflare's 25 MiB file limit explicitly |
| `story-cli/src/lib.mjs` | audit actor uses `USER` only (empty on Windows → `local-operator`) |
| `story-cli/src/storyframe.mjs` | arg filter drops any positional equal to a flag value; `doctor` checks almost nothing |
| `tests/protocol/publishing.test.js` | fails on a fresh clone: it needs `stories:build` first (1/15 red until you build) |
| `.gitignore` | ignores `stories-host/packages/` but not `registry.json`/`audit-log.json` → half the content plane would be committed to `main`, the other half lost |
| `server.mjs` | CSP lacks `font-src` that the README table documents (drift between docs and code) |
| each story | bespoke `build-package.mjs` — CI would have to execute author code to build |

## 2. What v2 changes (and the invariant each change protects)

1. **`packages/publishing` (new, isomorphic plain ESM).** Pure `validatePackage`,
   pure SHA-256, the declarative builder, the Quick Book compiler + five themes, the
   compatibility checker, the cover generator, `_headers` generation, commit planning.
   The CLI, CI, and the Admin Studio import the same files. *(Invariant 2.)*
2. **Declarative builds.** A `build` block in `storyframe.json` replaces every
   `build-package.mjs`; CI only ever runs the builder, never uploaded code.
   Both shipped books are migrated and must still pass the audit. *(Invariants 2, 5.)*
3. **Protocol 1.1 (additive).** `notes.write` capability + `NOTE_ADD`; negotiation by
   hello version so every 1.0 package keeps working unchanged. Manifest gains optional
   `migrations`, `cover`, `synopsis`, `accent`. *(Invariants 1, 4.)*
4. **Compatibility gate.** Promotion is blocked when a candidate removes/renames IDs
   without a `stateSchemaVersion` bump and a complete migration map; the reducer applies
   the map when a reader resumes on a newer release. *(Invariants 3, 4.)*
5. **Git is the CMS.** `main` holds sources; a `content` branch holds the immutable
   published tree; GitHub Actions runs the real CLI and deploys two Cloudflare Pages
   projects with `wrangler`. Operator actions become `workflow_dispatch` runs.
   *(Invariants 3, 7.)*
6. **Runtime config.** `/config.json` read at boot (`storyOrigin`, optional Supabase and
   GitHub settings) so a drag-and-drop zip can be re-pointed without a rebuild.
7. **Admin Studio (`#/admin`).** Dashboard, New Book wizard (three lanes), in-browser
   validate + compile + opaque-sandbox preview with a real bridge, publish = one Git
   commit. PAT lives in `sessionStorage` only. *(Invariants 1, 2, 7.)*
8. **Reader.** Shelf redesign with search/filters, story detail with a checkpoint map and
   release notes, immersive player with a live quick-settings drawer, onboarding, command
   palette, offline centre, archive gallery + timeline tree + replay, notes, local stats,
   i18n catalogue. *(Invariant 6.)*
9. **Phones.** PWA polish (PNG + maskable icons, shortcuts, install prompt, update banner)
   and a Capacitor Android wrapper with an APK workflow.
10. **Honesty.** `STATUS.md` rewritten with real test/audit output; anything not run
    against real infrastructure stays 📦.

## 3. Order of work (each step ends with `npm test` green)

| step | content | exit check |
|---|---|---|
| 0 | Windows/CI fixes; `packages/publishing` validator + sha256; CLI on top; doctor | 15 old tests + new validator tests |
| 1 | protocol 1.1, migrations, compat checker, bridge/SDK negotiation | reducer/bridge tests incl. 1.0 stories |
| 2 | declarative builder, both books migrated, Quick Book compiler + themes, `storyframe new`, third book | builder/compiler tests, three books publish |
| 3 | runtime config, `_headers`, deploy bundles, workflows, content branch scripts | config/headers tests, bundles build |
| 4 | app shell: config boot, i18n, reader P1 → P2 | `npm run build`, audit |
| 5 | Admin Studio | audit wizard happy path |
| 6 | PWA + Capacitor | manifest check, APK workflow lint |
| 7 | `verify.mjs` extensions, docs, ADRs, `STATUS.md`, zips | `npm test`, `npm run verify` |

## 4. Assumptions (one line each)

- Cloudflare Pages free tier is the static host; limits are re-checked on the vendor docs and dated in `DEPLOY.md`.
- The PAT is a fine-grained token scoped to one repository (Contents RW, Actions RW).
- Raster images are inlined as-is (base64); only SVG is minified — no native image codecs in CI.
- Supabase sync is wired behind `config.json`; without a live project it stays 📦.
- Quick Books are escaped Markdown (no raw HTML) so an uploaded text cannot inject script.

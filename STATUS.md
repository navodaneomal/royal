# STATUS — honest scope (v2)

Date: 2026-09-24 · Version: 2.0.0 · Data plane: local (Supabase adapter optional, not activated here)

Real summary lines from the final run of this tree:

```
$ npm test
 Test Files  13 passed (13)
      Tests  102 passed (102)

$ npm run typecheck
> tsc --noEmit                      (0 errors)

$ npm run verify
ALL 89 CHECKS PASSED            (single-origin + cross-origin passes; shots/ written)
```

Legend — ✅ implemented **and exercised by an automated check** (the Playwright
audit `npm run verify`, or the vitest suite where named) · 🟡 implemented,
exercised by unit tests, a local simulation, or by hand, but not by the
browser audit · 📦 code-complete but **not run in this build** because it
needs something this environment does not have (a GitHub repo with secrets, a
Cloudflare account, a Supabase project, a Windows machine, an Android device) ·
⬜ not built.

## v1 P0 criteria — still green

| # | Criterion | State | Evidence |
|---|---|---|---|
| P0.1 | Browse a catalog, open a story | ✅ | audit: all three books on the shelf; launch |
| P0.2 | Each story keeps its own visual identity in a sandboxed frame | ✅ | audit shots 03, 05, 07 (terminal, watercolor Quick Book, manuscript) |
| P0.3 | Secure handshake; forged messages ignored | ✅ | audit: opaque handshake 1.1↔1.1; unit: wrong source / wrong nonce ignored |
| P0.4 | Frame isolation (no app DOM, storage, cookies) | ✅ | audit evaluates inside the frames: `parent.document` and `localStorage` throw, `self.origin === "null"` — for the shipped books **and** every Admin preview theme |
| P0.5 | Atomic semantic commits, idempotency, base revision | ✅ | reducer unit tests + audit save-chip flow |
| P0.6 | Resume at the right semantic checkpoint after reload | ✅ | audit |
| P0.7 | Conflict → archived timeline + reader choice | ✅ | audit: two tabs → “Two timelines were found” |
| P0.8 | Canonical choices never flip | ✅ | reducer test + audit (“locked after commit”; replay keeps the old timeline intact) |
| P0.9 | Immutable releases, channels, promote / rollback / disable, audit log | ✅ | unit tests (registry ops, determinism) + CI simulation below |
| P0.10 | Offline download, integrity check, offline play, honest save state | ✅ | audit: download → offline → blob playback; CSP meta travels in the blob (fetch blocked) |
| P0.11 | One accessibility profile applied live to every story | ✅ | audit: drawer text 150% reaches Neon live; every Quick Book theme honours text 2× and motion none |
| P0.12 | WCAG 2.2 AA basics in the shell | ✅ | audit: measured contrast on every screen in light, dark, and more-contrast (≥ 7:1); one h1; labelled controls; skip link; `lang` |
| P0.13 | Guest-first; export + delete everything | 🟡 | Settings; exercised by hand, not scripted |
| P0.15 | Cloud sync | 📦 | see Phase 1 → Supabase |

## Phase 0 — Windows and CI

| Item | State | Evidence |
|---|---|---|
| CLI `REPO` via `fileURLToPath`; `dev.mjs` uses `npm.cmd` + shell on win32 | 📦 on Windows · ✅ on Linux | these code paths run on every build and test here (Linux); `ci.yml` has a `windows-latest` job that has **not** run yet |
| Playwright is a devDependency, imported normally | ✅ | `verify.mjs` → `import { chromium } from 'playwright'` |
| Fresh-clone `npm test` (v1 failed without a built SDK) | ✅ | tests build the SDK and packages in memory |
| Cover `svg / png / webp / jpg`, declared in the manifest | 🟡 | schema + validator unit tests (missing cover flagged) |
| Pure `validatePackage({ manifest, files })` in `packages/publishing` | ✅ | same file runs in the CLI build, in CI, and in the browser (audit: “in-browser release gate passes”) |
| 25 MiB per-file cap + declared budget | 🟡 | unit test |
| `npm run doctor` (Node, SDK, git, Playwright, host dir, deploy env) | 🟡 | run by hand here; also a CI step |

## Phase 1 — $0 hosting, Git as the CMS

| Item | State | Evidence |
|---|---|---|
| Releases persist on a `content` branch; audit actor = `GITHUB_ACTOR` | 🟡 | `scripts/ci/*.mjs` run against a local bare remote: orphan branch created, two fresh checkouts gave identical release ids, promote from a fresh runner, compat-blocked promote printed the fix, audit actors recorded |
| `publish.yml` / `app.yml` / `ci.yml` / `android.yml` on GitHub Actions | 📦 | not run on GitHub (needs the repo pushed with `CLOUDFLARE_*` secrets); the scripts they call are the ones simulated above |
| `_headers` for stories (immutable packages, no-cache registry, story CSP, CORS) and app (CSP `frame-src` = stories origin + `blob:`) | ✅ | unit tests (`tests/publishing/hosting.test.js`) + generated bundles inspected |
| Runtime `/config.json` (env var still overrides; secret-like keys refused) | ✅ | unit tests (`tests/app/config.test.ts`) + audit's cross-origin pass boots from a `config.json` pointing at another origin |
| Starter mode (single origin, every story opaque) | ✅ | the audit's main pass is exactly this build; `deploy/single-origin.zip` (42 files, 1.8 MB) |
| Production mode (two origins, two zips) | ✅ locally · 📦 on Cloudflare | audit cross-origin pass on :4175 → :4174; `deploy/app.zip` (19 files) + `deploy/stories.zip` (24 files); never uploaded to Cloudflare from here |
| Operator actions via `workflow_dispatch` + live run status | 📦 | `lib/github.ts` (dispatch, find run by request, poll); needs a PAT and a real repo |
| Dev `/admin/*` API path kept | 🟡 | used by the dev host; audited dashboard reads it |
| PAT in `sessionStorage` only; `#/admin` hidden from nav without it | 🟡 | code (`lib/admin.ts`); by hand |
| Cloudflare Access hardening | documented | DEPLOY.md §13 |
| Supabase sync: magic link, guest → account import (`planImport`, `sf_import_progress`), cross-device conflict archive | 📦 | migrations, RPCs, `progress-commit` + `progress-import` functions and the app adapter are written, and `planImport` is unit-tested; **never run against a Supabase project**, so not ✅ |
| R2 + Worker instant uploads | ⬜ (by design) | documented as the upgrade path, DEPLOY.md §15 (R2 needs a card on file) |

## Phase 2 — Admin Studio (`#/admin`)

| Item | State | Evidence |
|---|---|---|
| Dashboard: books, channels, size, warnings, audit log with filters, health tiles | ✅ | audit (+ contrast, a11y) |
| Latest CI run status per book | 📦 | needs GitHub |
| Wizard: Quick Book from `.md` | ✅ | audit: front matter moved into the manifest |
| Wizard: Quick Book from `.docx` (mammoth, in the browser) | ✅ | audit (lazy mammoth chunk) + unit test of the HTML → Markdown step |
| Wizard: Crafted / Prebuilt `.zip` lanes (fflate) | 🟡 | builder unit tests cover both lanes; zip upload exercised by hand |
| Manifest editor (live zod errors, UUID, slug, semver bump, drag-to-reorder checkpoints, raw JSON) | ✅ form · 🟡 details | audit fills the form; reorder and raw JSON by hand |
| Cover generator + title contrast check | 🟡 | unit tests (`generateCover`, contrast) |
| Accessibility checklist | 🟡 | by hand |
| In-browser validate, grouped issues with fix lines | ✅ | audit |
| Preview: opaque blob frame, real bridge, device switcher, preference simulators, message log | ✅ | audit, **all five themes**: isolation checks inside the frame, text 2× + motion none honoured, log shows HELLO → WELCOME → READY → BOOTSTRAP → PREFERENCES_CHANGED |
| Publish: one Git Data API commit `publish(<slug>): v<version>`, then wait for CI and the registry | 📦 | commit plan unit-tested; the GitHub call needs a PAT |
| Compatibility checker + migration map, gate on promote and direct production publish | ✅ | unit tests (`compat.test.js`, `migrateSnapshot`) + CI simulation |
| Manifest diff between releases | 🟡 | unit tests (`diffManifests`) |
| Promote / rollback / disable / enable with confirm dialogs | 🟡 dev · 📦 GitHub | confirm dialogs by hand; dispatch path needs GitHub |
| Beta preview in the real app (`#/play/<slug>?channel=beta`) | 🟡 | by hand |
| Draft autosave to IndexedDB, explicit discard | 🟡 | by hand |

## Phase 3 — Making books

| Item | State | Evidence |
|---|---|---|
| Declarative builder (entry / concat / Quick Book / prebuilt); no book ships a build script; CI never runs story code | ✅ | unit tests (determinism, escape refusal, Tulip reproduction) + both v1 books rebuilt with it and audited |
| Quick Book compiler: chapters → checkpoints, `secret`, `achievement`, `choice` + `branch`, `ending`, images with required alt | ✅ | unit tests + audit plays The Keeper of Wend Light end to end in the opaque frame |
| Five themes (Manuscript, Terminal, Watercolor, Noir, Minimal), each honouring every preference | ✅ | unit tests (tokens, contrast) + audit per theme |
| `storyframe new <slug> --template quick|native|wrap` | 🟡 | unit test (`scaffoldStory`) + run by hand |
| Third book (Quick Book lane) | ✅ | The Keeper of Wend Light, `r6fae7801718c` |
| `docs/BOOK-AUTHORING.md` | done | lanes, manifest by field, directives, IDs + migrations, budgets, checklist |

## Phase 4 — Reader

| Item | State | Evidence |
|---|---|---|
| P1 Shelf: accent-tinted Continue hero, shelves, fuzzy search, filters, skeletons, empty/offline states | ✅ | audit (hero tint, search, filters) |
| P1 Story detail: synopsis, checkpoint map in story language, content-warning reveal, badges, CHANGELOG, “new edition” notice | ✅ map · 🟡 rest | audit checks the checkpoint map |
| P1 Immersive player: auto-hiding chrome, fullscreen, save chip, Esc, live settings drawer | ✅ | audit (auto-hide, return on pointer, touch keeps chrome, drawer) |
| P1 Onboarding (“How do you like to read?”) | ✅ | audit |
| P1 Command palette + shortcuts overlay | ✅ | audit |
| P1 Offline centre: download all, per-book use, quota meter, clean removal | ✅ | audit |
| P1 Auto re-download + re-verify when production moves | 🟡 | `lib/downloads.ts`; not scripted |
| P2 Archive gallery, secret achievements, endings, timeline tree with restore | ✅ | audit |
| P2 Replay from a checkpoint → new timeline | ✅ | audit |
| P2 Reading stats (local, opt-in, no streak guilt) | 🟡 | by hand |
| P2 Notes and bookmarks via protocol 1.1 (`notes.write`); 1.0 stories unchanged | ✅ | unit tests (negotiation, capability, size cap, 1.0 fallback) + audit (a note written in the story arrives in the shell) |
| P2 Share cards (OG HTML + PNG per book) + deep links | 🟡 | generated into `deploy/stories/share/`; inspected |
| P2 i18n-ready shell (English catalogue) | ✅ | unit test (`tests/app/i18n.test.js`) |
| P3 Ambient soundscape (muted by default) | 🟡 | by hand |
| P3 Reading reminders | ⬜ | not built — browsers can only remind while the app is open or installed, and iOS Safari tabs cannot; not worth a half-feature |

## Phase 5 — Phones

| Item | State | Evidence |
|---|---|---|
| PWA manifest: PNG 192/512 + maskable, screenshots, shortcuts, light/dark theme colours; iOS meta | 🟡 | generated by `scripts/gen-pwa-assets.mjs`; checked by hand |
| Custom install prompt, update-available banner; SW stays app-shell only | 🟡 | `lib/pwa.ts`, `public/sw.js` (never caches `/stories-host/` or `/share/`); not scripted |
| Mobile viewport | ✅ | audit at 390 px: shelf and Admin Studio without horizontal overflow, player chrome on touch |
| Capacitor Android wrapper + debug APK | 🟡 | built here: `dev.storyframe.reader`, targetSdk 35, 5,002,087 bytes, debug-signed, library bundled; inspected with `aapt2` and `apksigner`. Copy in `deploy/storyframe-debug.apk` |
| Sandboxed iframes, MessagePort, IndexedDB, Blob-URL playback inside Android WebView | 📦 | **not run on a device or emulator**. Same Chromium engine the audit uses, but unconfirmed |
| `android.yml` APK artifact on GitHub | 📦 | not run on GitHub |
| Store costs stated honestly; TWA (Bubblewrap) documented | done | DEPLOY.md §12, ADR-0010 |

## Phase 6 — Tests

- vitest: 13 files, 102 tests. Covers the reducer, migrations, import planning, the bridge (1.0 and 1.1), the validator, the builder, Quick Books, themes and covers, compat and diffs, `_headers`, registry ops, commit planning, docx import, scaffolding, runtime config, i18n, and the shared-protocol copy for Deno.
- `verify.mjs`: the v1 gates plus every v2 surface listed above. It runs twice: single-origin (every story opaque) and cross-origin (from a `config.json`). It measures contrast on every screen in three modes.

## Not built

- ⬜ Reading reminders (see above)
- ⬜ R2 + Worker instant publishing (documented upgrade path)
- ⬜ Payments, entitlements, social features
- ⬜ iOS wrapper (the PWA installs on iOS; the App Store needs a paid account)
- ⬜ Server-side telemetry pipeline (events stay in a local, consent-gated buffer; the dashboard's health tiles say “this device”)
- ⬜ Translated story content (the shell catalogue is i18n-ready; only English exists)

## Known limits, stated plainly

- **Publishing from the Admin Studio waits for CI.** A new book appears once the publish workflow finishes: minutes, not seconds. It hasn't been timed here because the workflow hasn't run on GitHub yet. That wait is the cost of $0 hosting and one source of truth.
- **Free Supabase projects pause after a week of inactivity.** The app stays local-first, so a paused project only delays sync.
- **Direct Upload Pages projects cannot be connected to Git later.** That is why CI deploys with `wrangler pages deploy` (DEPLOY.md §6, §8).
- **Conflict resolution is per device** until the Supabase adapter is switched on.
- **`sandbox` includes `allow-forms`** so text-input stories work (ADR-0003).
- **The debug APK is debug-signed.** It is fine for sideloading, but a store upload needs a release keystore.

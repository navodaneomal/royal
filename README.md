# Storyframe

**A story operating system.** Every title on the shelf can look and behave like its own
handcrafted website — its own typography, its own colours, its own interaction grammar —
while the reader keeps **one identity, one library, one accessibility profile, and one
continuous memory** across devices and across time.

The platform is furniture; the stories are the paintings.

```
npm install          # once — links the workspaces
npm run doctor       # Node, SDK, git, Playwright, deploy env
npm test             # contract tests: reducer, bridge, validator, builder, Quick Books, compat, …
npm run dev          # two-origin dev: app on :5173, story host on :4174 (+ dev admin API)
npm run build        # books → validate → publish (local) → app build → single dist/
npm run preview      # serve the production build on :4173
npm run verify       # the Playwright audit (needs: npx playwright install chromium)
npm run deploy:bundle   # drag-and-drop zips for Cloudflare Pages → deploy/
```

Windows 11, PowerShell or WSL — every command is the same. To put it online
for $0/month, follow **[DEPLOY.md](DEPLOY.md)**.

## On the shelf

| | |
|---|---|
| **The Tulip & The Jester** | A candlelit forgotten-manuscript novella — ten parts, hidden secrets, its entire visual world intact inside the frame. The *legacy wrap* lane: an existing single-file story brought in with a small glue file. |
| **Neon Horizon** | A phosphor-terminal puzzle story written natively against the SDK: semantic checkpoints, a three-level hint ladder with an accessible bypass, one canonical choice, two endings. |
| **The Keeper of Wend Light** | A three-chapter *Quick Book* written entirely in Markdown — a secret, a nested secret achievement, a canonical choice with branches, two endings, an illustration — in the Watercolor theme. |

Three deliberately different worlds; one invisible continuity layer.

## What v2 adds

- **Admin Studio** (`#/admin`) — drop a `.md`, `.docx`, or `.zip`; edit the manifest;
  generate a cover; confirm accessibility; run the *same* release gate CI runs; preview
  in an opaque sandbox with the real bridge; publish with one Git commit; promote,
  roll back, and pause books with live CI status.
- **Quick Books** — Markdown + five directives (`secret`, `achievement`, `choice`,
  `branch`, `ending`) + five themes (Manuscript, Terminal, Watercolor, Noir, Minimal),
  compiled into native SDK stories.
- **Declarative builds** — a `build` block in `storyframe.json`; no book ships a build
  script and CI never runs story code.
- **$0 hosting, Git as the CMS** — GitHub Actions runs the CLI, keeps immutable releases
  on a `content` branch, and deploys two Cloudflare Pages projects.
- **A calmer, richer reader** — cinematic Continue hero, search and filters, a
  checkpoint map in story language, immersive player with a live settings drawer,
  onboarding, command palette, offline centre, archive gallery, timeline tree with
  replay from any checkpoint, notes and bookmarks (protocol 1.1), local reading stats.
- **Safer releases** — a compatibility checker and migration map so renaming a
  chapter can never strand a reader mid-story.
- **Phones** — installable PWA and a Capacitor Android wrapper with an APK workflow.

## The three planes

```
┌─────────────────────────  APPLICATION PLANE  ─────────────────────────┐
│  apps/web — React PWA: shelf, player, archive, offline, settings,      │
│  Admin Studio. Owns identity, progress, preferences, downloads.        │
│  Reads /config.json at boot (one build, any deployment).               │
└──────────────────────────────┬────────────────────────────────────────┘
                               │  sandboxed iframe + private MessagePort (1.1)
┌──────────────────────────────▼────────────────  CONTENT PLANE  ───────┐
│  Immutable, content-addressed packages (`r` + sha256[:12]) on a        │
│  separate origin; channels are pointers in registry.json; the whole    │
│  tree lives on the `content` branch and is written only by CI.         │
└──────────────────────────────┬────────────────────────────────────────┘
                               │  same reducer, same schemas
┌──────────────────────────────▼────────────────  DATA PLANE  ──────────┐
│  Local adapter (IndexedDB, guest-first) — always on.                   │
│  Supabase adapter (magic link, edge functions, RLS) — optional,        │
│  switched on by config.json. See STATUS.md.                            │
└───────────────────────────────────────────────────────────────────────┘
```

## What lives where

```
packages/protocol     schemas + the pure reducer (+ migrations, import planning) — the ONE set of rules
packages/publishing   validator · declarative builder · Quick Book compiler + themes · compat checker ·
                      registry ops · _headers · covers · docx import  (browser = Node = CI)
packages/story-sdk    what stories embed: connect() → handshake → session API (progress, prefs, notes)
packages/bridge-host  the host side: nonce, origin, schema, rate, size, sequence, capabilities, negotiation
packages/story-cli    storyframe new | build | validate | pack | publish | compat | promote | rollback |
                      disable | enable | list | doctor
stories/…             three books (native, wrap, quick) — sources + manifests with build blocks
apps/web              the reader + Admin Studio (React + Vite PWA)
apps/mobile           Capacitor Android wrapper
infra/story-host      dev content server (immutable caching, CSP, dev admin API)
scripts/              dev · preview · deploy bundles · share cards · CI orchestration · PWA assets
supabase/             migrations (RLS), commit + import RPCs, progress-commit + progress-import functions
.github/workflows     ci · publish (content plane) · app · android
tests/                vitest contract tests · verify.mjs — the browser audit
docs/                 ARCHITECTURE · BOOK-AUTHORING · protocol · accessibility · runbook · ADRs 0001–0011
```

## The rules that make it trustworthy

- **Stories are quarantined.** Online: cross-origin frame, exact-origin handshake,
  private port. Offline and single-origin: an **opaque** sandbox (`origin: "null"`)
  that cannot touch app storage, cookies, or DOM, and receives no reader data in the
  wildcard welcome. The story CSP (`connect-src 'none'`) travels inside every package,
  so even an offline copy cannot reach the network. `npm run verify` proves all of it
  from inside the frames.
- **One contract everywhere.** The reducer, schemas, validator, and builder are the same
  files in the browser, the CLI, CI, and the edge functions.
- **Releases are immutable.** Content-addressed folders + `integrity.json`; promote,
  rollback, and disable move pointers and append to the audit log — nothing is deleted.
- **Progress is semantic and atomic.** Conflicts become archived timelines; canonical
  choices never flip; renaming IDs requires a migration the reducer applies on resume.
- **Accessibility is a release gate.** Keyboard and screen-reader declarations are
  mandatory, one preference profile reaches every story live, and the audit measures
  contrast on every screen in light, dark, and more-contrast modes.
- **Honesty.** Nothing says "synced", "published", or "deployed" unless it happened.
  `STATUS.md` separates what is verified from what is merely code-complete.

## Documentation

| | |
|---|---|
| [`DEPLOY.md`](DEPLOY.md) | $0 deployment, click by click, with verified free-tier limits and troubleshooting |
| [`STATUS.md`](STATUS.md) | honest acceptance matrix — verified, code-complete, or not built |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | planes, publishing flow, trust boundaries, where each secret lives |
| [`docs/BOOK-AUTHORING.md`](docs/BOOK-AUTHORING.md) | making books: lanes, Quick Book syntax, manifest, IDs and migrations, checklist |
| [`docs/protocol.md`](docs/protocol.md) | the bridge: handshake, negotiation, envelope, mutations, notes |
| [`docs/accessibility.md`](docs/accessibility.md) | the preference contract and the WCAG 2.2 AA posture |
| [`docs/incident-runbook.md`](docs/incident-runbook.md) | broken release / wrong content / progress incidents / blocked publishes |
| [`docs/decisions/`](docs/decisions) | ADR-0001…0011 — the load-bearing decisions |
| [`docs/v2-plan.md`](docs/v2-plan.md) | what v1 was, what v2 changed, and why |

# Storyframe

**A story operating system.** Every title on the shelf can look and behave like its own
handcrafted website — its own typography, its own colours, its own interaction grammar —
while the reader keeps **one identity, one library, one accessibility profile, and one
continuous memory** across devices and across time.

The platform is furniture; the stories are the paintings.

```
npm install          # once — links the workspaces
npm test             # 15 contract tests: reducer atomicity, envelopes, publishing
npm run dev          # two-origin dev: app on :5173, story host on :4174
npm run build        # stories → validate → publish → app build → single dist/
npm run preview      # serve the production build on :4173
npm run verify       # full Playwright audit incl. hostile-frame checks (needs Chromium)
```

Open the app, and two stories are already published to the `production` channel:

| | |
|---|---|
| **The Tulip & The Jester** | A candlelit forgotten-manuscript novella — ten parts, hidden secrets, its entire visual world intact inside the frame. A *legacy integration*: an existing single-file story wrapped for the bridge without rewriting it. |
| **Neon Horizon** | A phosphor-terminal puzzle story written natively against the SDK: semantic checkpoints, a three-level hint ladder with an accessible bypass, one canonical choice, two endings. |

The point of shipping two deliberately opposite stories is the platform's whole thesis:
radically different worlds, one invisible continuity layer.

## The three planes

```
┌─────────────────────────  APPLICATION PLANE  ─────────────────────────┐
│  apps/web — React PWA: shelf, player shell, archive, settings,        │
│  operator console. Owns identity, progress, preferences, downloads.   │
└──────────────────────────────┬────────────────────────────────────────┘
                               │  sandboxed iframe + private MessagePort
┌──────────────────────────────▼────────────────  CONTENT PLANE  ───────┐
│  infra/story-host — immutable, content-addressed story packages       │
│  (`r` + sha256[:12]) on a separate origin. Channels are pointers in   │
│  registry.json; promote / rollback / disable never rewrite files.     │
└──────────────────────────────┬────────────────────────────────────────┘
                               │  same reducer, same schemas
┌──────────────────────────────▼────────────────  DATA PLANE  ──────────┐
│  Local adapter (IndexedDB, guest-first) — active in this build.       │
│  Supabase adapter (Auth + Postgres + RLS + Edge Function) — complete  │
│  in supabase/, activates when a project is configured. See STATUS.md. │
└───────────────────────────────────────────────────────────────────────┘
```

## What lives where

```
packages/protocol     schemas.js (zod contracts) + reducer.js — the ONE set of rules
                      shared verbatim by the app, the CLI, and the edge function
packages/story-sdk    what stories embed: connect() → handshake → typed session API
packages/bridge-host  the host side: nonce handshake, validation, capabilities,
                      rate limits, sequence replay rejection, acks
packages/story-cli    storyframe validate | pack | publish | promote | rollback |
                      disable | enable | doctor
stories/…             two story sources + their manifests + package builders
infra/story-host      dev/preview content server (immutable caching, CSP, dev admin API)
apps/web              the reader application (React + Vite PWA)
supabase/             migrations (RLS), sf_commit_progress RPC, progress-commit function
tests/                vitest contract tests · verify.mjs — the browser audit
docs/                 protocol · author guide · accessibility · incident runbook · ADRs
```

## The rules that make it trustworthy

- **Stories are quarantined.** Online: cross-origin frame, exact-origin postMessage,
  private MessagePort after a nonce handshake. Offline/preview: an **opaque** sandbox —
  `origin: "null"` — which cannot touch app storage, cookies, or DOM, and receives *no
  reader data* in the wildcard welcome. `npm run verify` proves both from inside the frame.
- **Progress is semantic and atomic.** Checkpoint IDs, never scroll positions. A mutation
  (checkpoint + items + achievements) applies entirely or not at all; every operation has
  an `operationId` (idempotent replay) and a `baseRevision` (conflict detection).
- **Conflicts are archived, never overwritten.** A stale commit becomes an archived
  timeline and the reader chooses — "Two timelines were found." Ten rolling snapshot
  backups per timeline are restorable from Settings.
- **Releases are immutable.** Publishing writes a content-addressed folder plus an
  `integrity.json`; downloads re-hash every byte before a package is accepted. Promote,
  rollback, and disable move pointers and append to the audit log — nothing is deleted.
- **Accessibility is a release gate.** Keyboard and screen-reader declarations are
  mandatory in the manifest; the reader's one preference profile (type, motion, contrast,
  sound, puzzle assistance) reaches every running story live over the bridge.

## Documentation

| | |
|---|---|
| `STATUS.md` | honest P0 acceptance matrix — what is implemented, verified, or code-ready |
| `docs/protocol.md` | the bridge: handshake, envelope, mutation grammar, ack semantics |
| `docs/author-guide.md` | writing a story against the SDK, or wrapping an existing one |
| `docs/accessibility.md` | the preference contract and the WCAG 2.2 AA posture |
| `docs/incident-runbook.md` | broken release / wrong content / progress incident drills |
| `docs/decisions/` | ADR-0001…0004 — the four load-bearing engineering decisions |
| `infra/story-host/README.md` | deploying the content plane to real static hosting |

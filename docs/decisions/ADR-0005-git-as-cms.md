# ADR-0005 — Git is the CMS: sources on `main`, the content plane on a `content` branch, CI runs the CLI

**Status:** accepted (v2)

## Context

Storyframe must be hostable for $0/month with no credit card, publishing must
keep the immutable-release model as the single source of truth, and the
operator console must stay "a window, not a second source of truth". Free
static hosts (Cloudflare Pages) serve files; they do not run our CLI. And a
fresh CI checkout would lose every earlier release, because
`stories-host/packages/` was never committed — rollback would silently break.

## Decision

- **`main` holds sources** (`stories/<slug>/`: manifest, text, assets). The
  Admin Studio publishes by making **one commit** there through the GitHub Git
  Data API (`publish(<slug>): v<version>`).
- **`content` holds the published tree** — every immutable release folder,
  `registry.json`, `audit-log.json` — as an orphan branch that shares no
  history with `main`. CI checks it out as a git worktree at
  `infra/story-host/stories-host/` (`scripts/ci/content-branch.mjs`), runs the
  CLI, commits, and pushes. Releases survive every run; rollback always has
  something to roll back to.
- **GitHub Actions runs the real CLI** (`scripts/ci/content.mjs` imports the
  same `lib.mjs` as `npm run storyframe`): push to `stories/**` → build →
  validate → publish to **beta**; `workflow_dispatch` → promote / rollback /
  disable / enable. One `concurrency` group serialises writers; the audit
  actor is `GITHUB_ACTOR`.
- **Two Cloudflare Pages projects** (app, stories) — separate origins keep the
  non-opaque online mode. First deploy by drag-and-drop; afterwards CI deploys
  with `wrangler pages deploy` (a Direct Upload project cannot later be
  connected to Git, per Cloudflare's docs).
- The console's operator buttons dispatch the workflow and poll the run; the
  dev host's `/admin/*` API remains for local development only.

## Consequences

- Every change to the content plane is a commit: auditable twice (git history
  + `audit-log.json`), revertable, reviewable.
- Publishing latency is a CI run (~1–2 minutes). Instant uploads would need R2
  + a Worker (documented upgrade path; R2 needs a payment method on file).
- The Admin Studio needs a fine-grained PAT (Contents RW, Actions RW, one
  repo) held in `sessionStorage` only.
- Verified locally by simulating two fresh runners against a bare remote:
  orphan creation, publish, promote on a new runner, and a compat-blocked
  promotion (see `STATUS.md`).

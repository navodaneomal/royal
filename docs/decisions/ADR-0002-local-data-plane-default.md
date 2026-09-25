# ADR-0002 — guest-first local data plane by default; Supabase adapter shipped complete but inactive

**Status:** accepted

## Context

The blueprint's data plane is Supabase (Auth, Postgres + RLS, Edge Functions). This
deliverable must run anywhere — including with no cloud project at all — and must
never *pretend* to sync.

## Decision

- The active adapter is **local**: IndexedDB, guest-first identity, the full §35
  commit algorithm (idempotency journal, base-revision conflict check, divergence
  archive, 10-snapshot backup ring) executed inside a **single IndexedDB
  transaction** (`atomically()`), mirroring the server transaction one-for-one.
- The **cloud adapter ships code-complete** in `supabase/`: migrations with RLS on
  every table (clients cannot write authoritative tables at all), the
  `sf_commit_progress` RPC (row-locked, single transaction, revoked from anon/
  authenticated — callable only by the service role), and the `progress-commit` edge
  function that runs *the same reducer file* before the RPC.
- The UI tells the truth: Settings says progress is on-device, names `supabase/` and
  `STATUS.md`, and STATUS.md marks cloud sync **code-ready, unverified**.

## Consequences

- Every behavioural promise (atomicity, idempotency, conflicts-as-timelines) is
  exercised in this build even without a server, because it is the same algorithm.
- Activating the cloud is configuration (deploy migrations + function, set
  `VITE_SUPABASE_URL`/anon key), not a rewrite — but until someone does and verifies
  it, no document in this repo claims cross-device sync works.
- Guest→account upgrade paths, magic-link UI, and cross-device conflict UX remain
  future work tracked in STATUS.md.

## v2 update

- Activation is now runtime configuration: `supabaseUrl` + `supabaseAnonKey` in
  `/config.json` (ADR-0008) switch on the adapter in `apps/web/src/lib/cloud.ts`
  (magic link with PKCE, lazy-loaded client).
- Guest → account upgrade and "keep this device" go through a new
  `progress-import` function and `sf_import_progress` RPC (migration 0004):
  the account's timeline stays canonical, guest discoveries are union-merged
  (`planImport` in the shared reducer), and the losing snapshot is archived as
  its own timeline — never overwritten.
- Both functions now read release manifests from the public content plane
  (`STORIES_ORIGIN`). v1 looked them up in `story_versions`, which nothing
  populated — every commit would have failed with `release_not_approved`.
- Still true: none of this has been run against a live project in this
  repository, so `STATUS.md` keeps cloud sync at 📦. The pure decision logic
  (`planImport`, `unknownSnapshotIds`, `migrateSnapshot`) is unit-tested.

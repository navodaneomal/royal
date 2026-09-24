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

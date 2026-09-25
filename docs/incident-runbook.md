# Incident runbook (blueprint §29)

Principles: **stop the bleeding with pointers, never with edits** · releases are
immutable, so every action is reversible · progress is sacred — no remedy may
touch reader snapshots · every action lands in the append-only audit log.

Three equivalent ways to act (the console is a window, not a second source of
truth — every path runs the same CLI library):

- **Admin Studio** → the book's release page → Rollback / Disable / Enable /
  Promote. With GitHub connected this dispatches `publish.yml`; the run's live
  status is shown, and the audit log records you as the actor.
- **GitHub** → Actions → *publish* → *Run workflow* → pick the action and slug.
- **CLI** with the `content` branch checked out (`node scripts/ci/content-branch.mjs
  checkout`): `npm run storyframe -- <cmd>`, then commit the branch and redeploy.

## 1. Broken release in production

Symptoms: `story_runtime_error` spikes, handshake timeouts, readers report a story
that will not start.

```
storyframe disable <slug>          # kill switch: shelf shows “Paused by operator”,
                                   # progress stays safe, nothing is deleted
storyframe rollback <slug>         # pointer back to the previous release
storyframe enable <slug>
```

Then reproduce against the bad release (it still exists, content-addressed), fix,
publish a **new** release, promote it. Never edit files under `releases/`.

**Rolling back across a `stateSchemaVersion` bump** (v2): allowed — it is an
emergency lever — and the CLI warns. Readers who already saved on the newer
edition keep their saves; the older edition may not recognise their newest
checkpoint, and the app tells them so honestly. Prefer *disable* + fix-forward
when the bad release renamed IDs.

## 2. Wrong content published (typo, spoiler, missing asset)

Not an emergency: publish the corrected package, `storyframe promote <slug> <releaseId>`.
Readers mid-session finish on the old release; new sessions get the new one. If the
error is harmful (leaked content), treat as §1 and disable first.

## 3. Progress-integrity incident

Symptoms: a reader reports lost or wrong progress; `progress_conflict_detected`
without user action; ack errors.

1. Do **not** touch their data. Every commit is journaled in `operations`, every
   revision kept in the 10-snapshot backup ring, every divergence archived.
2. Reader-side recovery: Settings → snapshots → restore (restores as a **new**
   revision — history is never rewritten), or Settings → archived divergence →
   “Restore this attempt”.
3. Diagnose from the operation journal: idempotency replays and conflicts are
   recorded with base/resulting revisions.
4. If a story is committing garbage (schema-valid but semantically wrong), disable
   the release (§1) — the reducer already blocks unknown IDs, so “garbage” usually
   means a story-logic bug in a new release.

## 4. Suspected malicious or compromised story package

1. `storyframe disable <slug>` immediately.
2. Evidence is already preserved: the immutable release folder, `integrity.json`,
   the audit log, and per-device `bridge_invalid_message` / `bridge_hello_rejected`
   counters.
3. Remember what the sandbox already guarantees: no app storage, no cookies, no
   parent DOM, no network beyond its own origin (CSP `connect-src 'none'`), reader
   data only over the port and never in an opaque welcome. The blast radius of a
   hostile package is its own frame.
4. Re-validate the source (`storyframe validate`), re-pack, compare hashes against
   the published `integrity.json` to find tampering.

## 5. Story host outage

The app keeps working: catalog falls back to its cached copy, downloaded stories play
offline from verified local packages, and saves continue locally. Restore the host;
nothing else to do — this failure mode is a designed-for state, not an incident in
the app.

## 6. A publish is blocked

- *validate* failed: the run summary lists each issue with a "fix:" line (the
  Admin Studio's Validate step shows the same, because it runs the same code).
- *promote* refused with "stateSchemaVersion" or "migration": the candidate
  renamed or removed IDs. Add the migration (`docs/BOOK-AUTHORING.md` §10),
  publish again, promote. Never bypass the gate — it is what keeps readers'
  saves resumable.

## 7. CI or hosting is down

The app and every downloaded story keep working (§5). Content changes wait;
nothing is lost because every change is a commit. When GitHub Actions is back,
re-run the failed workflow — actions are idempotent (publishing identical
bytes reuses the same release id).

## Audit trail

`audit-log.json` (on the `content` branch) is append-only; every publish / promote /
rollback / disable / enable records actor (`GITHUB_ACTOR` in CI), action, slug,
release, channel, and timestamp — and the branch history records the same change
as a commit. The Admin Studio dashboard renders the file with filters. If an entry seems missing, the console reads
the file directly — check the host, not the console.

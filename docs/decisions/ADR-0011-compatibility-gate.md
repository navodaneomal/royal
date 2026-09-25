# ADR-0011 — Promotion is gated by a compatibility checker and a migration map

**Status:** accepted (v2)

## Context

Progress is semantic: snapshots reference checkpoint, item, achievement,
choice, and ending IDs. A new release that renames or removes one strands
every reader mid-story on it — silently, because the reducer only validates
*new* mutations.

## Decision

- Manifests gain `migrations: [{ from, to, checkpoints, items, achievements,
  choices, choiceOptions, endings }]`. Renames move data; `null` retires an ID
  without deleting reader data; checkpoints can only be renamed.
- `checkCompatibility(current, candidate)` blocks promotion (and direct
  publishes to production) when IDs disappear without a `stateSchemaVersion`
  bump and a migration chain covering every one; it also blocks a changed
  `storyId` and a schema version going backwards.
- `migrateSnapshot` (in the shared reducer) applies the map when a reader
  resumes on a newer release — in the app before bootstrap (stored as a new
  revision; the old snapshot stays in the backup ring) and in the edge
  functions. A canonical choice keeps its meaning; only its spelling may change.
- Rolling back across a schema bump is allowed (it is an emergency lever) but
  warned about, and the app tells affected readers honestly.
- Per-release metadata in `registry.json`: a beta publish no longer rewrites
  the IDs production playback validates against (a v1 bug).

## Consequences

- Authors get the fix as a line of JSON in the error message.
- Tested end to end: a rename is blocked in CI, and with a migration the
  snapshot moves across and keeps working with the new release.

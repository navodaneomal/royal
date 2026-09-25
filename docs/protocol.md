# The Storyframe bridge protocol (v1.1 — additive over v1.0)

The only doorway between a story and the platform. Everything in this document is
enforced by code in `packages/protocol` (schemas + reducer), `packages/bridge-host`
(host side), and `packages/story-sdk` (story side) — the same files, imported by the
web app, the CLI, and the Supabase edge function. If this document and the code ever
disagree, the code is the contract and this file has a bug.

## 1. Frame modes

| mode | sandbox | document origin | welcome target |
|---|---|---|---|
| `cross-origin-online` | `allow-scripts allow-same-origin allow-forms` | the story host's origin | exact origin |
| `opaque-offline` | `allow-scripts allow-forms` | `"null"` (opaque) | `"*"` — and therefore **carries no reader data** |

Same-origin previews always use the opaque mode: a story is never trusted with the
application's origin. `allow-forms` is granted in both modes — rationale in ADR-0003 §3.

## 2. Handshake

```
host                                      story (SDK)
────                                      ───────────
iframe.src = entry#sf_nonce=<128-bit>  →  reads nonce from the fragment
                                       ←  window.parent.postMessage(STORYFRAME_HELLO
                                            {protocol:'1.0', accepts:['1.0','1.1'],
                                             storyId, releaseId, nonce}, '*')
verify: event.source === iframe.contentWindow
        event.origin (exact in online mode)
        schema, nonce equality, story/release match
negotiate: highest of {protocol} ∪ accepts that the host supports
STORYFRAME_WELCOME {protocol:<negotiated>} + MessagePort → all further traffic on the port
```

### Version negotiation (1.1)

The hello's `protocol` stays at the base version every host understands
(`1.0`); newer versions are *offered* in `accepts`. The host answers with the
highest common version in the welcome, and from then on **every envelope in
both directions must carry exactly that version** — a mismatch is rejected as
`protocol_mismatch`. Consequences:

| SDK | host | session |
|---|---|---|
| 1.0 (no `accepts`) | 1.1 | 1.0 — plays exactly as before |
| 1.1 | 1.1 | 1.1 — `session.notes` available (with `notes.write`) |
| 1.1 | 1.0 (stale cached app) | 1.0 — the 1.0 host ignores `accepts`; `session.notes` is absent |

- The nonce is unguessable, present only in the URL fragment (never sent to servers),
  and single-use. A hello with the wrong source, origin, schema, nonce, storyId, or
  releaseId is counted (`bridge_hello_rejected`) and ignored — the audit forges one to
  prove it.
- In `opaque-offline` mode the welcome contains **no preferences and no progress**;
  the story receives them only after `READY`, over the port.

## 3. Envelope

Every port message, both directions:

```json
{
  "protocol": "1.0",
  "type": "PROGRESS_COMMIT",
  "messageId": "uuid",
  "sessionId": "sess-…",
  "storyId": "uuid", "releaseId": "r<sha256[:12]>",
  "sequence": 17,
  "sentAt": "ISO-8601",
  "payload": { }
}
```

Host-side enforcement, in order: rate limit (60 messages / 1000 ms) → byte cap
(64 KB) → schema → story/release/session match → **monotonic sequence** (replays
rejected). Ten invalid messages close the bridge with a diagnostic ID.

## 4. Message types

| direction | type | meaning |
|---|---|---|
| story → host | `READY` | story booted; host replies `BOOTSTRAP` |
| host → story | `BOOTSTRAP` | preferences + progress snapshot + resume flag + revision |
| story → host | `PROGRESS_COMMIT` | one atomic mutation (below) |
| host → story | `PROGRESS_ACK` / `PROGRESS_ERROR` | result, `inReplyTo` the commit's messageId |
| story → host | `ACHIEVEMENT_UNLOCK` | sugar for a `state_patch` with one achievement |
| story → host | `UI_REQUEST` | `exit` · `toast` · `fullscreen` · `report_issue` |
| host → story | `PREFERENCES_CHANGED` | the live preference profile, applied immediately |
| host → story | `LIFECYCLE` | `pause` · `resume` · `closing` |
| story → host | `NOTE_ADD` *(1.1)* | `{ anchorId, text ≤ 2000, kind: note\|bookmark, label? }` |
| host → story | `NOTE_ACK` *(1.1)* | `{ inReplyTo, status: 'saved', noteId }` |

## 5. The mutation grammar

A commit's payload is `{ operationId, baseRevision, mutation }`:

```js
{
  type: 'checkpoint' | 'state_patch' | 'discovery' | 'puzzle_completed'
      | 'choice_committed' | 'ending',
  checkpointId?, set?, visit?,                       // story-defined state
  grantItems?: [{ itemId, quantity }],
  unlockAchievements?: [id],
  hintLevel?: { puzzleId, level },                   // monotonic, never regresses
  choiceId?, choiceOption?,                          // canonical choices
  endingId?
}
```

Reducer guarantees (unit-tested):

- **Atomic**: every referenced checkpoint/item/achievement/choice/ending is validated
  against the release manifest *before* anything applies. One unknown ID rejects the
  whole mutation (`unknown_item`, `unknown_choice_option`, …).
- **Idempotent**: replaying an `operationId` returns the stored result; achievements
  never double-unlock.
- **Canonical choices are permanent**: a second `choice_committed` for the same
  `choiceId` fails with `choice_already_committed`. Re-deciding is a story-design
  feature (new timeline), never a silent flip.
- **Conflicts**: `baseRevision` mismatch → the mutation is archived as a divergent
  timeline candidate and the ack says `conflict`; the shell raises the
  “Two timelines were found” dialog. Nothing is overwritten.

## 6. Capabilities

The manifest declares what a story may do: `progress.read`, `progress.write`,
`inventory.write`, `achievement.unlock`, `choice.commit`, `ui.fullscreen`,
`ui.share`, and — protocol 1.1 — `notes.write`. The host checks each mutation
part (and each note) against the declared list; undeclared parts are refused
per-message (`capability_denied`) without closing the bridge. The validator
refuses a manifest that declares a capability newer than its
`protocolVersion`.

In a **1.0 session**, `NOTE_ADD` is simply an unknown message type (counted as
invalid, exactly as before). In a **1.1 session without `notes.write`**, it is
refused per message.

SDK (1.1): `session.protocol` is the negotiated version; `session.notes.add({
anchorId, text, kind, label })` exists only in a 1.1 session and resolves with
the ack. Notes are the reader's own words: the local data plane keeps them on
the device, and they are included in "Export my data".

## 6b. Migrations on resume (v2)

A release may rename or retire IDs only with a `stateSchemaVersion` bump and a
`migrations` entry (`{ from, to, checkpoints, items, achievements, choices,
choiceOptions, endings }`). When a reader's snapshot is older than the
release, the shell applies `migrateSnapshot` (shared reducer) **before**
bootstrap and stores the result as a new revision; the story only ever sees a
snapshot in its own vocabulary. Promotion is blocked by the compatibility
checker until the map covers every removed ID (ADR-0011).

## 7. Sizes and limits

| thing | limit |
|---|---|
| port message | 64 KB |
| progress snapshot | 256 KB |
| snapshot backups kept | 10 per timeline |
| messages per second | 60 |
| invalid messages before close | 10 |
| note text (1.1) | 2,000 characters |

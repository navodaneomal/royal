# The Storyframe bridge protocol (v1.0)

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
                                            {protocol, storyId, releaseId, nonce}, '*')
verify: event.source === iframe.contentWindow
        event.origin (exact in online mode)
        schema, nonce equality, story/release match
STORYFRAME_WELCOME + MessagePort       →  all further traffic on the private port
```

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

The manifest declares what a story may do (`progress.write`, `inventory.write`,
`achievement.unlock`, `choice.commit`, `audio.play`, `fullscreen.request`).
The host checks each mutation part against the declared list; undeclared parts are
refused per-message (`capability_denied`) without closing the bridge.

## 7. Sizes and limits

| thing | limit |
|---|---|
| port message | 64 KB |
| progress snapshot | 256 KB |
| snapshot backups kept | 10 per timeline |
| messages per second | 60 |
| invalid messages before close | 10 |

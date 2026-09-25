# ADR-0009 — Protocol 1.1: notes, negotiated additively

**Status:** accepted (v2)

## Context

Readers want notes and bookmarks inside stories. The bridge must stay
backward compatible in both directions: new hosts must run 1.0 packages
unchanged, and a new package meeting a stale cached 1.0 app must not fail.

## Decision

- 1.1 adds one capability (`notes.write`) and one message pair
  (`NOTE_ADD` → `NOTE_ACK`), SDK `session.notes.add({ anchorId, text, kind })`.
- **Negotiation like TLS:** the hello keeps `protocol: "1.0"` (every host
  accepts it) and adds `accepts: ["1.0", "1.1"]`. The host picks the highest
  common version and states it in the welcome; every envelope must then carry
  exactly that version (`protocol_mismatch` otherwise). A 1.0 host ignores
  `accepts` and answers 1.0; the SDK then never exposes `session.notes`.
- In a 1.0 session `NOTE_ADD` is an unknown type (counted as invalid, as in
  v1). In a 1.1 session without `notes.write` it is refused per message.
- The manifest validator ties capabilities to protocol versions.

## Consequences

- Tested with the real bridge-host over real `MessageChannel`s: a 1.0 hello
  plays exactly as before; 1.1 notes save; notes are refused without the
  capability; payloads are size-capped.
- Notes stay on the device in the local data plane and are included in
  "Export my data".

# STATUS — honest scope

Date: 2026-08-22 · Build: local data plane · Tests: `npm test` 15/15 · Audit: `npm run verify` ALL CHECKS PASSED

Legend — ✅ implemented **and exercised by the automated audit** · 🟡 implemented, exercised manually or by unit tests only · 📦 code-complete but **not activated/verified in this build** (needs a configured Supabase project) · ⬜ not built (P1/P2 or out of scope for this deliverable).

## P0 acceptance criteria (blueprint §21.1)

| # | Criterion | State | Evidence |
|---|---|---|---|
| P0.1 | Reader can browse a catalog and open a story | ✅ | audit: shelf shows both cards; launch works |
| P0.2 | Story runs in a sandboxed frame with its own full visual identity | ✅ | audit screenshots 03/06 — phosphor terminal and candlelit manuscript, both intact in-frame |
| P0.3 | Secure handshake; forged/hostile messages ignored | ✅ | audit: nonce handshake OK; forged `STORYFRAME_HELLO` from the top document ignored; invalid-message counters in operator console |
| P0.4 | Frame isolation: no app storage / DOM / cookies from a story | ✅ | audit evaluates *inside* the frame: `parent.document` throws, `localStorage` throws, `self.origin === "null"` |
| P0.5 | Atomic semantic progress commits with idempotency + base revision | ✅ | reducer unit tests (all-or-nothing, idempotent replay) + audit save-chip flow |
| P0.6 | Resume across full reload at the correct semantic checkpoint | ✅ | audit: “SESSION RESTORED. The station remembered you.” |
| P0.7 | Conflict → archived timeline + reader choice, nothing overwritten | ✅ | audit: two tabs, one timeline → “Two timelines were found” dialog |
| P0.8 | Canonical choices never silently flip | ✅ | reducer test `choice_already_committed` + audit replay attempt refused |
| P0.9 | Immutable releases, channels, promote/rollback/disable, audit log | ✅ | publishing unit tests + operator console; pointers only, files never rewritten |
| P0.10 | Offline download with integrity verification; offline play + honest save state | ✅ | audit: download → `ctx.setOffline(true)` → blob playback → “Offline — saved on this device” |
| P0.11 | One accessibility profile applied live to every story | ✅ | preferences travel over the bridge (`PREFERENCES_CHANGED`); motion/contrast/text scale honoured by both stories |
| P0.12 | WCAG 2.2 AA basics in the shell | ✅ | audit: contrast ≥4.5 (body 14.16, muted 4.86), single h1, labelled controls, skip link, keyboard paths |
| P0.13 | Guest-first identity; export + delete everything | 🟡 | implemented in Settings; exercised manually (not scripted in the audit) |
| P0.14 | Publishing CLI with validation gates | ✅ | external-origin scan, ID uniqueness, entrypoint, budgets, accessibility declarations — a Google-Fonts leak in the Tulip package was caught by this gate during development and fixed |
| P0.15 | Cloud sync (accounts, cross-device, server-authoritative commits) | 📦 | `supabase/` ships migrations + RLS + `sf_commit_progress` RPC + `progress-commit` edge function using the **same reducer file**; **not deployed, therefore not verified**. The app runs the identical algorithm locally. |

## Not in this build

- ⬜ Real accounts / magic-link UI (activates with the Supabase adapter; Settings says so honestly)
- ⬜ Payments, entitlements, social features, editorial CMS (P2 in the blueprint)
- ⬜ Multi-language story packages (schema fields exist; only `en` content shipped)
- ⬜ Push notifications / background sync
- ⬜ Server-side telemetry pipeline (events are allowlisted and consent-gated, but stay in a local ring buffer)

## Known limits, stated plainly

- The **operator console's admin actions** work against the dev story host's admin API; on a static production host they intentionally degrade to showing the equivalent CLI command instead of pretending.
- **Conflict resolution is per-device** in the local data plane; cross-device conflict archiving needs the cloud adapter.
- The service worker caches the **app shell only**; stories are never served by it (see ADR-0003 for why that is a feature).
- `sandbox` includes `allow-forms` so text-input stories work; the rationale and the threat-model argument are in ADR-0003.

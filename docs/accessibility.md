# Accessibility — one profile, every world

Target: **WCAG 2.2 AA** for the application shell, and a **release gate** that makes
stories declare — and honour — the same bar. The core mechanism: the reader sets
their profile **once**, and every story receives it live over the bridge. No story
ever renegotiates font size with the reader.

## The preference contract (blueprint §20.2)

| preference | values | shell behaviour | story obligation |
|---|---|---|---|
| `colorScheme` | system/light/dark | full token swap | may keep its own palette (it is art), should respect contrast |
| `textScale` | 0.8–2.0 | `--text-scale` on root | scale body type accordingly |
| `lineHeight` | compact/normal/relaxed | applied to shell text | apply to long-form prose |
| `fontMode` | story/readable/dyslexia-friendly | swaps shell stacks | `readable`/`dyslexia-friendly` override story faces for body text |
| `contrast` | normal/more | `[data-contrast=more]` raises muted ink to full | raise contrast of interactive + body text |
| `motion` | full/reduced/none | shell animations stop | **mandatory**: stop ambient/parallax/auto-playing motion |
| `sound` | muted/on | — | audio only after explicit opt-in |
| `captions` | bool | — | captions/transcripts where audio speaks |
| `puzzleAssist` | standard/untimed/guided | — | no forced timers; `guided` offers hints sooner; assistance is never scored as failure |

Delivery: profile in `BOOTSTRAP`, updates as `PREFERENCES_CHANGED` while running.
Both shipped stories apply motion, text scale, and contrast live; Neon Horizon's
hint ladder + `ALIGN AUTO` bypass is the reference for `puzzleAssist`.

## What the release gate checks (`storyframe validate`)

- `accessibility.keyboard` and `accessibility.screenReader` must be declared true —
  and the author guide defines what that declaration promises.
- Alt text fields on items with meaningful imagery (the archive renders them, with
  provenance).
- Budgets that keep stories usable on modest devices.

## What the shell itself does

- Semantic landmarks, one `h1` per view, labelled controls, `:focus-visible` rings.
- Skip link to main content; full keyboard paths for every flow, dialogs included.
- Save state as a polite live region (`role="status"`) — screen readers hear
  “Saved on this device” without interruption.
- Conflict and error surfaces are `role="alert"` dialogs with real text, not toasts.
- Colour tokens hold ≥4.5:1 for text in both schemes (muted ink included — audited).
- `[data-contrast=more]` collapses the muted-ink ramp to full ink and strengthens
  hairlines.
- No shell animation is load-bearing; everything respects `motion`.

## Verified how

`npm run verify` measures contrast ratios computationally, counts `h1`s, checks for
unlabelled buttons and the skip link, and exercises the whole app keyboard-first at
desktop and 390 px mobile widths. This is a floor, not a ceiling: it catches
regressions; human testing with actual AT remains the real bar for release.

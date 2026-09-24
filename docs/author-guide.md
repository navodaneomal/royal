# Author guide — building a story for Storyframe

A story is a folder: your HTML/CSS/JS world, a `storyframe.json` manifest, and a
build script that produces a self-contained package. You own the aesthetic entirely —
the platform never injects UI into your frame. In exchange you follow three rules:
**semantic progress**, **no external origins**, and **honour the reader's preferences**.

The two shipped stories are the two integration patterns, and both are meant to be
copied from:

- `stories/neon-horizon` — a **native** story: written against the SDK from the start.
- `stories/the-tulip-and-the-jester` — a **legacy wrap**: an existing single-file story
  instrumented with a small glue file, without rewriting its internals.

## 1. Manifest (`storyframe.json`)

```jsonc
{
  "schema": "storyframe.v1",
  "storyId": "uuid — mint once, never change",
  "slug": "neon-horizon",
  "title": "Neon Horizon",
  "version": "1.0.0",
  "entrypoint": "index.html",
  "capabilities": ["progress.write", "inventory.write", "achievement.unlock", "choice.commit"],
  "checkpoints": [{ "id": "hall", "title": "The Relay Hall", "order": 1 }],
  "items":        [{ "id": "logbook-page", "title": "Logbook page", "alt": "…" }],
  "achievements": [{ "id": "listener", "title": "A Patient Ear", "secret": true }],
  "choices":      [{ "id": "final-call", "options": ["transmit", "stay"], "canonical": true }],
  "endings":      [{ "id": "kept-company", "title": "Kept Company" }],
  "offline":      { "eligible": true, "maxBytes": 52428800 },
  "accessibility": { "keyboard": true, "screenReader": true, "motionSafe": true }
}
```

Checkpoint **titles are reader-facing** — the shelf says “Part I — The Birthday”,
never “checkpoint 3”. Write them in your story's language.

## 2. The SDK in five lines

The build inlines `storyframe-sdk.iife.js` (10 KB, global `StoryframeSDK`; also exposed
as `window.Storyframe`). Then:

```js
const session = await Storyframe.connect({ storyId: STORY_ID, releaseId: RELEASE_ID })
const boot = await session.ready()            // { resume, revision, preferences, progress }
restore(boot.progress)                        // YOUR semantic state, from the snapshot
session.preferences.onChange(applyPrefs)      // live — motion, textScale, contrast, sound…
await session.progress.commit({ type: 'checkpoint', checkpointId: 'hall', set: myState })
```

`connect()` also works when your file is opened directly during authoring — you get a
standalone session with in-memory saves, so your dev loop is just “open the HTML file”.

Commit rules of thumb:

- Commit **moments, not scrolls**: a chapter entered, a puzzle solved, an item found.
- Put everything the reader would cry about losing in one mutation — it applies
  atomically or not at all.
- Never commit a canonical choice until the reader has truly decided; it cannot be
  silently changed later (`choice_already_committed` is the platform keeping your
  promise to the reader).
- Hints: report `hintLevel` honestly. Levels never regress, and untimed/guided modes
  are never treated as failure.

## 3. Accessibility is a release gate

`storyframe validate` refuses a package that does not declare keyboard and
screen-reader support — and the declaration must be true:

- Everything reachable by keyboard; visible focus; no keyboard traps.
- Honour `preferences.motion` (`reduced`/`none` ⇒ stop ambient animation),
  `textScale`, `contrast`, and `sound: muted` (opt-in audio only).
- Provide text alternatives for meaningful imagery; captions where audio speaks.
- No flashing content beyond WCAG 2.3 thresholds. No forced timers on puzzles —
  Neon Horizon's hint ladder + `ALIGN AUTO` bypass is the reference pattern.

## 4. Packaging and publishing

```
node stories/<slug>/build-package.mjs      # → stories/<slug>/package/ (self-contained)
npm run storyframe validate stories/<slug>
npm run storyframe publish  stories/<slug> --channel production --yes
```

Validation gates that will actually stop you: any `http(s)://` reference to an
external origin (fonts, CDNs, analytics — inline everything; the Tulip's Google-Fonts
links were caught by exactly this gate), `fetch()` calls, missing manifest IDs,
duplicate IDs, missing entrypoint, package over budget, missing accessibility
declarations.

Publishing is **immutable**: your package is copied to a content-addressed release
(`r` + sha256[:12]), `integrity.json` records the hash of every file, and the channel
pointer moves. Fixing a bug means publishing a new release and promoting it; the old
one stays forever, and `rollback` is instant and safe.

## 5. Wrapping an existing story (the Tulip pattern)

You do not need to rewrite a finished story. The Tulip wrap is ~120 lines:

1. Defer the original boot: wrap the IIFE as `window.__START_APP__ = function () {…}`
   and start it only after the bridge bootstrap arrives.
2. Restore: map `boot.progress.storyState` back onto the story's own state object
   before first render.
3. Instrument commit points: dispatch `CustomEvent`s (`sf:read`, `sf:secret`, …) at the
   moments that already existed, and translate them into `progress.commit` calls in the
   glue file.
4. Honour preferences by mapping them onto whatever switches the story already has
   (the Tulip's reduced-motion path existed; the glue just drives it).

The original file still runs standalone, unchanged in spirit — the glue is additive.

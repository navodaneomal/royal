# Making books for Storyframe

A book is a folder in `stories/<slug>/`. You describe it in `storyframe.json`,
and one generic builder turns the folder into a self-contained package — one
HTML file that carries its own world (fonts, colours, rules) and runs in a
sandbox, while the reader's shelf keeps their progress, archive, and
accessibility profile. You never write a build script.

**The fastest path:** Admin Studio → *New book* → *Quick Book* → paste or drop
your text → publish. The rest of this guide explains what that does, and how
to go further.

- [1. Choose a lane](#1-choose-a-lane)
- [2. The book folder](#2-the-book-folder)
- [3. Quick Books](#3-quick-books) — Markdown + five directives + five themes
- [4. Crafted books](#4-crafted-books) — your own HTML/CSS/JS against the SDK
- [5. The manifest, field by field](#5-the-manifest-field-by-field)
- [6. The build block](#6-the-build-block)
- [7. Saving progress well](#7-saving-progress-well)
- [8. Accessibility obligations](#8-accessibility-obligations)
- [9. Size budgets](#9-size-budgets)
- [10. IDs, stateSchemaVersion, and migrations](#10-ids-stateschemaversion-and-migrations)
- [11. Publishing](#11-publishing)
- [12. Checklist before you publish](#12-checklist-before-you-publish)

---

## 1. Choose a lane

| lane | you provide | good for | example |
|---|---|---|---|
| **Quick Book** | `book.md` (Markdown with directives), images | prose, branching fiction, illustrated stories — no code | `stories/the-keeper-of-wend-light` |
| **Crafted — native** | `src/index.html` + JS/CSS written against the SDK | puzzles, games, anything interactive | `stories/neon-horizon` |
| **Crafted — wrap** | an existing single-file story + a small glue file | bringing a finished web story in without rewriting it | `stories/the-tulip-and-the-jester` |
| **Prebuilt package** | a finished `index.html` (+ files) built elsewhere | exotic toolchains — you build, we validate and sandbox | — |

Start a folder with the scaffolder (fresh `storyId`, valid manifest,
generated cover, README, CHANGELOG):

```
npm run storyframe -- new my-book --template quick     # or native | wrap
npm run storyframe -- build my-book
npm run storyframe -- validate my-book
```

## 2. The book folder

```
stories/<slug>/
  storyframe.json      the manifest (+ build block, cover, migrations)
  cover.svg            or cover.png | cover.webp | cover.jpg (name it in "cover")
  book.md              Quick Book: the text
  src/                 Crafted: your HTML / CSS / JS
  assets/              images, fonts, audio — inlined into the package at build
  CHANGELOG.md         reader-facing release notes ("## 1.2.0" sections)
```

`package/` is build output (git-ignored). Never commit a `build-package.mjs`:
CI does not run story scripts, ever (ADR-0007).

## 3. Quick Books

Plain Markdown, HTML-escaped (raw HTML is shown as text, never run), plus a
handful of directives. The compiler turns it into a native SDK story and
derives the manifest's checkpoints, items, achievements, choices, and endings
from the text.

### Structure

```markdown
---
minutes: 12              # optional; otherwise estimated from word count
kicker: Part             # optional; "Part 2 of 3" instead of "Chapter 2 of 3"
---
# The Book Title

*An epigraph — shown on the cover page.*

## The First Chapter {#first}

Paragraphs, *emphasis*, **strong**, > quotes, - lists, `code`.

---                       (a scene break)

![What the picture shows](assets/harbour.webp "An optional caption")

See [the first chapter](#first).     ← links between chapters only
```

- `#` is the book title (one per book). `##` starts a chapter; **every chapter
  is a checkpoint**, committed when the reader enters it. Its label is the
  heading — so write headings in your story's voice.
- **Always give chapters an id**: `## The Storm {#storm}`. Without one, the id
  comes from the heading text and renaming the heading later would strand
  readers (the compiler warns; the Admin Studio locks ids on publish).
- Images need alt text: `![]()` is an error. They must live in `assets/`.
- Links to other websites keep their words but lose the URL — books cannot
  reach other origins.

### Directives

A container directive opens with `:::name{attributes}` and closes with a line
that is exactly `:::`. They nest.

**Secret** — a hidden discovery; goes to the reader's Archive (an *item*):

```markdown
:::secret{id="sea-pink" name="A pressed sea-pink" alt="A small pink flower pressed flat between two pages" hint="Something is tucked inside the back cover"}
Text only curious readers find.
:::
```

`name` and `alt` are required (the Archive reads `alt` to screen-reader
users); `hint` is the button label before it opens (never give the secret
away in it); `description` is optional (defaults to the first sentence).

**Achievement** — one line; unlocks when the block it sits in becomes visible
(the chapter, a revealed branch, or an opened secret):

```markdown
::achievement{id="first-light" name="First Light" description="Lit the lamp." secret}
```

**Choice + branches** — a canonical choice: once made, it stays made in that
timeline (readers replay from the Archive to choose differently):

```markdown
:::choice{id="the-signal" label="The small light is blinking. What do you do?"}
- answer: Shutter the lamp and answer the signal
- hold: Keep the beam turning, steady on the rocks
:::

:::branch{choice="the-signal" option="answer"}
Only readers who answered see this.
:::
:::branch{choice="the-signal" option="hold"}
Only readers who held the beam see this.
:::
```

Branches can appear in later chapters, and can contain anything — including
endings.

**Ending**:

```markdown
:::ending{id="answered" name="The Answered Signal"}
Closing text. The reader's shelf records the ending when it appears.
:::
```

`stories/the-keeper-of-wend-light/book.md` uses every one of these; read it
side by side with the rendered book.

### Themes

Set `build.quickbook.theme` (the Admin Studio has a picker):

| theme | world |
|---|---|
| `manuscript` | candlelit parchment, oxblood ink, drop caps |
| `terminal` | amber phosphor, scanlines, a patient cursor |
| `watercolor` | soft washes drifting at the edges of a clean page |
| `noir` | hard black, white type, one red light, film grain |
| `minimal` | clean modern reading; follows the reader's light/dark choice |

Every theme honours every reader preference — motion (ambient animation stops
for *reduced* and *none*), text scale, more contrast (each theme has its own
high-contrast palette, all ≥ 7:1 for body text — tested), readable and
dyslexia-friendly fonts, and line height. System fonts only, so books stay
small and work offline.

### Notes and bookmarks

Quick Books declare protocol 1.1 and `notes.write`: each chapter has
*Bookmark this chapter* and *Write a note*; notes land in the reader's Archive.

## 4. Crafted books

Your folder is a normal static web page. The builder inlines what it
references, so author it as if it were a local site:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="./style.css">        <!-- inlined -->
</head>
<body>
  <img src="../assets/map.webp" alt="A hand-drawn map">   <!-- inlined as data: -->
  <!-- storyframe:sdk -->                            <!-- the SDK goes here -->
  <script src="./story.js"></script>               <!-- inlined -->
</body>
</html>
```

### The SDK in five lines

```js
const session = await Storyframe.connect({ storyId: STORY_ID, releaseId: RELEASE_ID })
const boot = await session.ready()            // { resume, revision, preferences, progress }
restore(boot.progress)                        // YOUR semantic state, from the snapshot
session.preferences.onChange(applyPrefs)      // live — motion, textScale, contrast, sound…
await session.progress.commit({ type: 'checkpoint', checkpointId: 'hall', set: myState })
```

Read the release id from the stamped attribute:
`document.documentElement.getAttribute('data-sf-release')`. Opened directly
(double-clicked), `connect()` returns a standalone in-memory session, so your
dev loop is "open the HTML file".

`session.notes.add({ anchorId, text, kind: 'note' | 'bookmark' })` exists when
the host speaks 1.1 and your manifest declares `notes.write` (with
`protocolVersion: "1.1"`).

### Wrapping an existing story (the Tulip pattern)

1. Defer the original boot: wrap its start-up as `window.__START_APP__ = function () {…}`
   and end with `if (!window.__SF_DEFER__) window.__START_APP__()`.
2. In a glue file placed right after `@sdk`, set `window.__SF_DEFER__ = true`,
   connect, restore `boot.progress.storyState` into the story's own state,
   then call `__START_APP__()`.
3. Instrument moments the story already has (`CustomEvent`s like `sf:read`)
   and translate them into `progress.commit` calls in the glue.
4. Map preferences onto switches the story already has.

`npm run storyframe -- new my-wrap --template wrap` generates this skeleton.

## 5. The manifest, field by field

| field | required | meaning |
|---|---|---|
| `storyId` | ✓ | UUID minted once. Identifies the book forever; the Admin Studio locks it after the first publish. Changing it makes a different book. |
| `slug` | ✓ | web name (`lowercase-with-dashes`); also the folder name. |
| `version` | ✓ | semver. Bump it every publish; readers see it on the story page. |
| `protocolVersion` | ✓ | `1.0` or `1.1` (1.1 for notes). |
| `stateSchemaVersion` | ✓ | integer; raise only with a migration (§10). |
| `title`, `tagline`, `synopsis` | title ✓ | reader-facing. No spoilers in the synopsis. |
| `accent` | | `#rrggbb` — tints the Continue hero. Otherwise sampled from the cover. |
| `cover` | | file name; default `cover.svg`. SVG, PNG, WebP, or JPG. |
| `entrypoint` | ✓ | usually `index.html`. |
| `languages`, `defaultLanguage` | ✓ | e.g. `["en"]`, `"en"`. |
| `capabilities` | | what the story may do: `progress.write`, `inventory.write`, `achievement.unlock`, `choice.commit`, `notes.write` (1.1), `ui.fullscreen`. Anything undeclared is refused. |
| `content.rating` | ✓ | `everyone` · `teen` · `mature`. |
| `content.warnings` | | readers reveal these intentionally. Be honest. |
| `content.estimatedMinutes` | ✓ | `{ firstSession, total: [min, max] }`. |
| `accessibility` | ✓ | six booleans — see §8. `keyboard` and `screenReader` must be true to publish. |
| `offline` | ✓ | `{ eligible, maxBytes }` — the download budget readers accept. |
| `checkpoints` | ✓ | `[{ id, label, order }]` — reader-facing labels, ordered. |
| `items` | | `[{ id, name, alt, description, spoilerCheckpoint? }]` — `alt` required. |
| `achievements` | | `[{ id, name, description, secret }]`. |
| `choices` | | `[{ id, label, options: [ids] }]` — canonical. |
| `endings` | | `[{ id, name }]`. |
| `migrations` | | see §10. |
| `build` | ✓ | see §6. |

Quick Books derive `checkpoints` … `endings`, `capabilities`,
`accessibility`, and `estimatedMinutes` from the text.

## 6. The build block

Exactly one source mode:

```jsonc
{ "build": { "quickbook": { "source": "book.md", "theme": "watercolor" } } }
{ "build": { "entry": "src/index.html" } }
{ "build": { "concat": ["src/00-head.html", "src/10-body.html", "@sdk", "src/45-glue.js", "src/50-app.js"] } }
{ "build": { "prebuilt": "prebuilt" } }
```

Options: `"inline": { "scripts", "styles", "images", "fonts", "media" }` (all
`true` by default) and `"stripExternalFonts": true`. The builder also stamps
`data-sf-release` and the story Content-Security-Policy `<meta>` (so even an
offline copy cannot reach the network). References outside the story folder
are errors.

## 7. Saving progress well

- **Commit moments, not scrolls**: a chapter entered, a puzzle solved, an item
  found. Never on a timer, never on scroll position.
- **One mutation per moment**: checkpoint + items + achievements together. It
  applies atomically or not at all.
- **Never commit a canonical choice until the reader has truly decided** — it
  cannot be changed later (`choice_already_committed` is the platform keeping
  your promise to the reader). Re-deciding is a replay, on a new timeline.
- **Hints**: report `hintLevel` honestly; levels never regress, and untimed or
  guided play is never scored as failure.
- Store *your* state in `set: { … }` (booleans, numbers, strings, string
  arrays). Keep snapshots small — the limit is 256 KB.

## 8. Accessibility obligations

`storyframe validate` refuses a package that does not declare keyboard and
screen-reader support — and the declaration must be true:

| promise | means |
|---|---|
| `keyboard` | everything reachable and usable by keyboard; visible focus; no traps |
| `screenReader` | real text, alt text for meaningful images, named controls, announced changes |
| `reducedMotion` | `preferences.motion` `reduced`/`none` stops ambient, parallax, auto-play |
| `captions` | captions or transcripts wherever audio speaks (no audio also counts) |
| `untimedMode` | no scene depends on a timer, or there is a way around it |
| `nonAudioAlternative` | fully enjoyable with sound off |

Also honour `textScale`, `contrast: more`, and `fontMode`. No flashing beyond
WCAG 2.3 thresholds. `docs/accessibility.md` has the full contract; the Admin
Studio's checklist asks you to confirm each one.

## 9. Size budgets

| limit | value | why |
|---|---|---|
| any single file | **25 MiB** (hard) | Cloudflare Pages' per-file limit |
| a file over 10 MiB | warning | heavy on mobile data |
| entry HTML over 500 KB | warning | first-interaction guidance |
| whole package | your `offline.maxBytes` (hard) | readers download all of it |
| cover over 2 MB | warning | the shelf loads every cover |

Images are inlined as-is (SVG is minified). Export photos as WebP at the size
they display.

## 10. IDs, stateSchemaVersion, and migrations

Reader progress stores **IDs**: the checkpoint they are at, the items they
hold, the choices they made. Adding IDs is always safe. **Renaming or removing
one strands every reader who has it** — so the platform will not let you do it
by accident:

1. Raise `stateSchemaVersion` by one.
2. Add a migration saying where each removed ID went:

```json
"stateSchemaVersion": 2,
"migrations": [{
  "from": 1, "to": 2,
  "checkpoints": { "hall": "relay-hall" },
  "items": { "coil": "copper-coil", "old-draft-note": null },
  "choiceOptions": { "final-call": { "stay": "keep-company" } }
}]
```

- A rename moves the reader's data to the new ID. `null` retires an ID: the
  reader keeps it, it just stops being shown. Checkpoints cannot be retired —
  readers must resume somewhere real.
- A canonical choice keeps its meaning; only its spelling may change.
- Keep old migrations in the file; they chain (1→2, 2→3).

`storyframe compat <slug>` (and the Admin Studio's release page) compares a
build with production. Promotion — and publishing straight to production — is
blocked until the migration covers every removed ID. When a reader resumes on
the new edition, the shell migrates their snapshot before your story starts,
so your code only ever sees the new vocabulary.

## 11. Publishing

**Admin Studio:** *New book* (or open a draft) → Validate → Preview →
*Publish to beta*. That is one commit to `stories/<slug>/`; CI builds,
validates, and publishes to the **beta** channel. Try it with *Preview beta in
the app*, then *Promote* on the release page.

**CLI (local):**

```
npm run storyframe -- build <slug>
npm run storyframe -- validate <slug>
npm run storyframe -- publish <slug> --channel beta
npm run storyframe -- compat <slug>
npm run storyframe -- promote <slug>            # promotes whatever beta points at
```

Releases are immutable and content-addressed (`r` + sha256[:12]). Fixing a
typo is a new release; the old one stays forever, and `rollback` is instant.
Write reader-facing notes in `CHANGELOG.md` under `## <version>` — they appear
on the story page as "What's new in this edition".

## 12. Checklist before you publish

- [ ] `storyId` is the one minted for this book; `slug` matches the folder.
- [ ] `version` bumped; `CHANGELOG.md` has a section for it.
- [ ] Every chapter/checkpoint has a stable id you will never rename casually.
- [ ] Every image and secret has alt text that describes it.
- [ ] Content rating and warnings are honest.
- [ ] Accessibility promises are true — you tried it with the keyboard only,
      and with motion set to *None* and text at 200%.
- [ ] `storyframe validate` passes (no errors); warnings understood.
- [ ] `storyframe compat` passes against production (or a migration is in place).
- [ ] You played the beta in the real app before promoting.

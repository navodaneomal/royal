# ADR-0013 — One-screen workshop, books on this device, and a hosting centre

**Status:** accepted (v3 UI)

## Context

Making a book took eight wizard steps, and only the Studio could do it.
Putting the library online took a dozen settings clicks across GitHub and
Cloudflare. Both were correct, and both were too slow for the person who
just wants to read their own story, or share it.

## Decision

1. **`composeQuickBook`** (in `@storyframe/publishing`) turns text into a
   publishable book in one call: front matter, slug, next version, a cover
   matched to the theme, the accessibility the Quick Book runtime
   guarantees, chapter ids locked into `book.md` — then the same builder,
   release gate, and release-id hash CI runs. `textToQuickBookMarkdown`
   reads plain text the way manuscripts are typed (titles, "CHAPTER TWO",
   "Part III", "Prologue", scene breaks). Six starter books, one per theme,
   are validated by the unit tests.
2. **One workshop, two doors.** `#/add` (any reader) and `#/admin/publish`
   (the Studio) are the same lazy-loaded screen. The Studio adds "Publish for
   everyone": the existing one-commit path, plus an optional
   `workflow_dispatch` of `publish` with `channel=production` to skip beta.
   The 8-step wizard remains as *Advanced*.
3. **Books on this device** are stored like verified offline downloads: the
   catalog entry (registry shape, from `applyPublish`) in IndexedDB `kv`,
   the stamped single-file package as a Blob in `downloads`, with the hash
   we computed. They are merged into the catalog after the registry and
   never shadow a published book (a clashing slug becomes `<slug>-mine`).
   They play only from the Blob in the **opaque** sandbox with the story CSP
   inside the bytes — the ADR-0003 path, unchanged. The Studio dashboard,
   wizard, and offline downloads list ignore them.
4. **Hosting centre.** `inspectHosting` / `fixHosting` (pure, network
   injected) explain and finish the GitHub Pages setup: create `main` from
   the default branch's head, make it the default, switch Pages to "GitHub
   Actions", start a deployment. They run in the Studio's Hosting page and
   in `npm run setup:pages`, always with the **owner's own token**. The
   one-day setup token (Contents, Actions, Pages, Administration) lives in
   component state only; the everyday publishing token stays Contents +
   Actions. Token forms are pre-filled with GitHub's URL parameters.
5. **The shell, v3.** Sidebar on desktop, tab bar on phones, reader-chosen
   accent colours applied as inline custom properties per scheme and
   contrast mode (Brass leaves `app.css` in charge). `tests/app/themes.test.ts`
   reads the tokens from `app.css` and checks every ink, status colour, and
   accent on every surface (≥4.5:1; ≥7:1 in more-contrast).

## Consequences

- A reader can go from a `.txt` to reading it, offline and sandboxed, in
  seconds, with no account and nothing uploaded.
- Nothing about the trust model changed: no new origin, no new capability,
  the same CSP, the same isolation checks — now also run by the audit on a
  book made in the workshop.
- Books on a device are per-browser. Clearing site data removes them; the
  workshop's "Download the book folder" is the backup.
- The reader bundle grew by about 6 KB gzip (shell, icons, strings); the
  workshop, QR code, and Studio load only when opened.

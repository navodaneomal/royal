# Start here: Storyframe from A to Z

This guide takes you from **the zip file** to **a live library on the internet**
with your own books, and explains how every part works. You need about
30 minutes, a computer, and a free GitHub account. It costs $0.

| Part | What you do | Time |
|---|---|---|
| [1. What is in the zip](#1-what-is-in-the-zip) | Look around | 2 min |
| [2. Run it on your computer](#2-run-it-on-your-computer) | Unzip, install, start | 10 min |
| [3. Put it online with GitHub](#3-put-it-online-with-github) | Four settings on github.com | 5 min |
| [4. Connect the Studio](#4-connect-the-studio-your-publishing-token) | Make a token, paste it | 5 min |
| [5. Add books](#5-add-books) | Link, upload, or write | 2 min per book |
| [6. What readers can do](#6-what-readers-can-do) | — | — |
| [7. How it works](#7-how-it-works-the-journey-of-a-book) | Understand it | 10 min |
| [8. A to Z](#8-a-to-z) | Reference | — |
| [9. Commands](#9-commands) · [10. Keeping it running](#10-keeping-it-running-for-free) · [11. Troubleshooting](#11-troubleshooting) · [12. What is tested](#12-what-is-tested-and-what-is-not) | Reference | — |

---

## 1. What is in the zip

Unzipping gives you one folder, `storyframe/`:

| Item | What it is |
|---|---|
| `START-HERE.md` | This guide. |
| `HOST-IT-TODAY.md` | The 15-minute short version of parts 2–5. |
| `README.md`, `DEPLOY.md`, `STATUS.md` | Overview · every hosting option (incl. Cloudflare) · what is verified. |
| `apps/web/` | **The app**: the reader *and* the Studio (where you publish). |
| `apps/mobile/` | The Android wrapper around the same app. |
| `packages/` | The engine: rules, the book builder and checker, the story SDK, the command-line tool. |
| `stories/` | **Your books' sources.** Four ship as examples. |
| `.github/workflows/` | The automation GitHub runs for you (checks, publishing, hosting). This folder is hidden on some computers. |
| `deploy/` | Ready-made bundles: `pages.zip`, `single-origin.zip` (one-project Cloudflare), `app.zip` + `stories.zip` (two-project Cloudflare), and `storyframe-debug.apk` (Android). |
| `docs/` | Architecture, book authoring, the protocol, accessibility, decision records. |
| `tests/`, `verify.mjs` | 155 automated tests and a browser audit of 116 checks. |
| `supabase/` | Optional accounts and sync across devices. Off unless you switch it on. |

---

## 2. Run it on your computer

**Step 1. Install Node.js** (once). Download the **LTS** installer from
<https://nodejs.org> (version 20 or newer) and click through it. To check, open a
terminal and type `node -v`; it should print `v20…` or higher.

**Step 2. Unzip.** Windows: right-click the zip → **Extract All**. Mac:
double-click it. You get a folder called `storyframe`.

**Step 3. Open a terminal in that folder.**
- Windows: open the `storyframe` folder in File Explorer, click the address bar,
  type `powershell`, press Enter.
- Mac: open **Terminal**, type `cd ` (with a space), drag the folder onto the
  window, press Enter.

**Step 4. Install** (once, 1–3 minutes):

```bash
npm install
```

**Step 5. Start:**

```bash
npm start
```

This builds the books, checks them, builds the app, and serves it. When it
prints the address, open **<http://localhost:4173>**.

**Step 6. Try it:**

| Try this | What should happen |
|---|---|
| The shelf | Four books: *The Tulip & The Jester*, *Neon Horizon*, *The Keeper of Wend Light*, and *Alice's Adventures in Wonderland*. |
| *Alice* | A **linked book**: Project Gutenberg opens in a new tab. |
| *Neon Horizon* → Start reading → reload the page | A terminal-style story. After reloading, it remembers where you were. |
| **Add a book** → *Start from a template* → **Read it now** | A book made in seconds, kept privately on this computer. |
| **Add a book** → **Link a book hosted elsewhere** | Paste any link; a card with a cover appears. |
| Settings → *Accent colour* | The whole app re-tints. |

To stop: press **Ctrl+C** in the terminal. Next time, only Steps 3 and 5.

> Running on your computer is for trying things. Only you can see it, and only
> while it runs. Part 3 puts it online for everyone.

---

## 3. Put it online with GitHub

GitHub Pages hosts the whole thing (the reader, the books, the Studio) for free,
at `https://<your-name>.github.io/<repository>/`. Pick the route that fits you.

### Route A: your repository `navodaneomal/royal` (the code is already there)

You do **not** upload the zip; GitHub already has every file. Do these in order,
because step A2 must come before step A3.

**A1. Create the `main` branch.**
Open <https://github.com/navodaneomal/royal> → click the branch button at the
top left (it shows `claude/new-session-808kfk`) → type `main` → click
**Create branch main from claude/new-session-808kfk**.

**A2. Make `main` the default branch.**
**Settings** (gear icon) → **General** → *Default branch* → click **⇄** →
pick `main` → **Update** → **I understand, update the default branch**.
*(GitHub only lets the default branch deploy a site, and the Studio saves books to `main`.)*

**A3. Switch Pages on.**
**Settings** → **Pages** → *Build and deployment* → *Source*: **GitHub Actions**.
Ignore the workflows GitHub suggests (Jekyll, Static HTML); the project has its own.

**A4. Run the first deployment.**
**Actions** → (enable workflows if GitHub asks) → **pages** → **Run workflow** →
branch `main` → **Run workflow**. Wait 2–3 minutes for the green tick.

**A5. Open your library:** **<https://navodaneomal.github.io/royal/>**

> **Shortcut for A1–A4:** with the app running on your computer (Part 2), open
> <http://localhost:4173/#/admin/hosting>, click **Create one (pre-filled, expires in 1
> day)** next to *Setup token*, choose **Only select repositories → royal** on
> GitHub, generate it, paste it, then **Check** → **Fix it for me**.

### Route B: a brand-new repository from the zip

Use this to start over, or to make a second library.

**B1. Create an empty repository.** On GitHub: **+** → **New repository** → a
name (for example `library`) → **Public** (free Pages needs public) → do **not**
add a README, .gitignore, or licence → **Create repository**.

**B2. Upload the folder with Git.** Install Git from <https://git-scm.com> if
you do not have it. In a terminal inside the `storyframe` folder:

```bash
git init -b main
git add .
git commit -m "Storyframe"
git remote add origin https://github.com/<your-name>/<repository>.git
git push -u origin main
```

If Git asks you to sign in, choose the browser sign-in.
*No terminal?* Use **GitHub Desktop**: **File → Add local repository** → pick
the folder → *create a repository* → **Publish repository**, and **untick
"Keep this code private"**.

> Do not drag the files into GitHub's web page. It takes 100 files at a time and
> easily skips the hidden `.github` folder that holds the automation.
> `node_modules` and the ready-made bundles are left out automatically.

Automatic runs may start straight away (one may create the `content` branch,
where your published library lives). Runs that say "Pages is off" are expected.

**B3. Switch Pages on:** **Settings → Pages → Source: GitHub Actions**.
*(A new repository's default branch is already `main`, so there is no step like A2.)*

**B4. Deploy:** **Actions → pages → Run workflow → main**. Two to three minutes
later, open `https://<your-name>.github.io/<repository>/`.

---

## 4. Connect the Studio (your publishing token)

The Studio publishes by saving your book into your GitHub repository. To do that,
it needs a **token**: a password that only works for this one repository, for
90 days.

**Step 1. Create the token.** Open `https://<your-site>/#/admin/hosting`
(for you: <https://navodaneomal.github.io/royal/#/admin/hosting>) → **Everyday
publishing token**. GitHub's token page opens, already filled in.
*By hand instead:* your GitHub photo → **Settings** → **Developer settings** →
**Personal access tokens** → **Fine-grained tokens** → **Generate new token**.

Check:
- **Repository access**: **Only select repositories** → your repository
- **Repository permissions**: **Contents: Read and write** and **Actions: Read and write**

**Generate token**, then copy it (it starts with `github_pat_`). GitHub shows it
only once. Never post it or put it in a file.

**Step 2. Paste it.** Open `https://<your-site>/#/admin/connect`. *Repository*
and *Source branch* (`main`) are already filled in. Paste the token into
**Fine-grained token** → **Save** → **Test connection**.

The token is kept only in that browser tab, nowhere else. If you close the tab,
paste it again; a password manager makes this quick.

---

## 5. Add books

| Kind of book | Where | Who sees it |
|---|---|---|
| **Linked**: hosted elsewhere (a website, PDF link, Google Drive/Docs, YouTube, Vimeo, a flipbook) | Studio → Home → **Link a book** | Everyone |
| **Written or uploaded**: `.docx`, `.txt`, `.md`, or typed in | Studio → **Publish** | Everyone |
| **Kept on one device**: any of the above, without publishing | **Add a book** (any reader) → *Add to my shelf* / *Read it now* | Only that browser |
| **Advanced**: a full interactive story (`.zip`, custom HTML) | Studio → **Advanced** (8-step wizard) | Everyone |

### Link a book (one)
1. Studio → Home → **Link a book**.
2. Paste the link. The title, kind, and a designed cover are filled in for you.
   Share links are fixed automatically (Drive and Docs become previews, YouTube a
   private player).
3. Optional: title, author, tagline, description, your own cover image, and
   **how it opens**: *in a new tab* (always works) or *inside the app* (for sites
   that allow it).
4. Leave **"Put it on the shelf right away"** ticked → **Publish for everyone**.

### Link many at once
**Many at once** tab → paste one book per line → **Publish for everyone**:

```
The Lantern Fox | https://example.com/fox.pdf
Small Hours — Ada Byron | https://drive.google.com/file/d/…/view
https://heyzine.com/flip-book/atlas.html
```

A spreadsheet saved as CSV (`title,author,url`) works too.

### Publish a written book
Studio → **Publish** → write, paste, or drop a `.docx` / `.txt` / `.md` file.
Chapters ("CHAPTER ONE", "Part III", `# headings`) are found for you. Pick a
theme and cover → **Publish for everyone**.

### What happens after you click Publish
1. The Studio checks the book **in your browser** with the same checks GitHub
   will run, then saves it to `stories/<book>/` on `main` in one commit.
2. On GitHub, the **publish** run builds and checks it again and releases it
   (about 1 minute).
3. The **pages** run rebuilds the site (about 2 minutes).
4. GitHub caches pages for up to 10 minutes; **Ctrl+F5** shows the newest.

The progress panel in the Studio, and the **Actions** tab on GitHub, show each step.

### Managing a book later
Studio → Home → click a book:
- **Promote beta to production**: books published without "right away" go to a
  *beta* channel first, so you can check them before readers see them.
- **Roll back production**: return to the previous version instantly.
- **Disable (kill switch)**: hide a book from the shelf. Nothing is deleted;
  **Enable** brings it back.

To **update** a book, open **Publish** (or **Link a book**), set *This book is*
→ *A new edition of "…"*, and publish. It becomes the next version, and readers
keep their place.

---

## 6. What readers can do

- **Shelf**: search, filter, a "Start here" pick, and **Continue reading** that
  opens the right chapter.
- **Read**: each book runs in its own sealed frame with its own design. Press
  **F** for full screen.
- **Linked books**: open on their own site; readers can **Mark as finished**.
- **Install**: on a phone, **Install** (or *Add to Home screen*) makes it an app
  that updates itself.
- **Offline**: Offline centre → *Download all*; downloaded books open without
  internet.
- **Notes, bookmarks, archive, timeline**: replay from any checkpoint.
- **Settings**: text size, spacing, typeface, contrast, motion, sound, five accent
  colours, language. Every book receives them.
- **Share**: every book page has a QR code.
- **Your data**: kept on the device. *Export my data* and *Delete everything*
  are in Settings.
- **Ctrl+K** (⌘K on Mac) opens the command palette.

---

## 7. How it works: the journey of a book

```
 YOU, in the Studio (any browser)
   │ 1. build + check the book in the browser (the same code GitHub runs)
   │ 2. one commit → stories/<book>/ on main            (your publishing token)
   ▼
 GITHUB ACTIONS · "publish"
   │ 3. tests → build → release gate (checks safety, accessibility, size)
   │ 4. the book becomes a release named after its fingerprint (r + 12 hex)
   │ 5. release + registry.json + audit log → the `content` branch
   ▼
 GITHUB ACTIONS · "pages"
   │ 6. app + whole library → one site
   │ 7. deploy → https://<you>.github.io/<repo>/
   ▼
 A READER's browser or phone
     8. loads the app (it opens offline after the first visit)
     9. reads registry.json → the shelf
    10. opens a book in a sealed frame → progress is saved on the device
```

The system has **three layers** that never mix:

| Layer | What it is | Where it lives |
|---|---|---|
| **The app** | The reader + the Studio. One build that works at any address; it reads `config.json` when it starts. | `apps/web` → your Pages site |
| **The library** | Every release of every book, never changed after publishing. `registry.json` says which release each *channel* (beta, production) shows. | The `content` branch → your Pages site |
| **Reader data** | Progress, notes, bookmarks, settings, downloads. | Each reader's own browser (IndexedDB). Optional cloud sync with Supabase. |

**Why it is safe**
- **Books cannot touch the app.** Each runs in a sandboxed frame with no access to
  the app's storage, cookies, or page, and no network access (its own security
  policy travels inside the book). They talk to the app only through a checked
  message channel (the *bridge*).
- **GitHub never runs a book's code.** Books are assembled by a declarative
  builder from a recipe in `storyframe.json`.
- **Releases cannot change.** A release's name is its fingerprint; downloads are
  re-checked byte for byte. Promote, roll back, and disable only move pointers,
  and every action is logged.
- **Linked books stay at arm's length.** They open in a new tab, or in a
  sandboxed frame that gets no reader data. Only the exact sites of
  embedded links are allowed into the app's security policy.
- **Your token stays with you.** It lives only in your browser tab, never in the
  repository or the site.

---

## 8. A to Z

**A · Admin Studio.** `#/admin`: where you publish, link, manage releases, set up
hosting, and connect GitHub. Its menu entry appears once a token is saved; before
that, open `#/admin/connect` directly.

**B · Bridge.** The checked message channel between a book's sealed frame and the
app. Every message is checked for origin, a secret one-time code, shape, size, rate,
and order.

**C · Channels.** *beta* and *production*: pointers to a release. Readers see
production; you check beta first, then promote.

**D · Declarative builder.** Turns a book folder into a release from the recipe
in `storyframe.json`. No book ever ships its own build script.

**E · Embedding.** A linked book set to *open inside the app* shows in a sandboxed
frame with an "Open on …" button. It works only if that site allows it; otherwise
choose *new tab*.

**F · Fix it for me.** The Hosting centre's button: creates `main`, makes it the
default, switches Pages on, starts the first deploy. It needs a one-day setup token.

**G · Git as the CMS.** There is no database or server to pay for. Book sources live on
`main`, published releases on `content`, and GitHub Actions does the work.

**H · Hash.** Each release is named `r` + the first 12 characters of the SHA-256
fingerprint of its files, so the same book always gets the same name, and a
changed book always gets a new one.

**I · Install and integrity.** The app installs like a phone app (a PWA).
`integrity.json` lists every file's fingerprint; downloads are verified against it.

**J · JSON manifest.** `storyframe.json` in each book folder: title, cover,
chapters (checkpoints), accessibility, the build recipe, and, for linked books,
the link.

**K · Kill switch.** *Disable* hides a book everywhere at once. *Enable* brings it
back. Nothing is deleted.

**L · Linked books.** A card with a cover that opens a book hosted anywhere. Its
release holds only the card (`storyframe.json` + cover). It goes through the same
checks, versions, and rollbacks as any book.

**M · Migrations.** If you rename a chapter, a compatibility check makes sure no
reader is left stranded mid-story; a migration moves them to the new name.

**N · Notes and bookmarks.** Readers can add them inside books that support them.
They are kept with their progress.

**O · Offline.** The app opens without internet after the first visit; books
downloaded in the Offline centre play without internet, in the strictest sandbox.

**P · Promote and roll back.** Move production to a newer release (after a
compatibility check) or back to the previous one, in one click.

**Q · Quick Books.** Books written in Markdown, with five extras (`secret`,
`achievement`, `choice`, `branch`, `ending`) and five themes (Manuscript,
Terminal, Watercolor, Noir, Minimal). The Studio writes these for you from
`.docx` / `.txt`.

**R · Registry.** `registry.json`: every book, its releases, and which release
each channel points to. The shelf is drawn from it.

**S · Sandbox.** The sealed frame every book runs in. On GitHub Pages it is the
strictest kind (an *opaque* origin).

**T · Tokens.** *Publishing token* (Contents + Actions, 90 days) for the Studio;
*setup token* (1 day) only for "Fix it for me". Both are made for one repository.

**U · Updates.** New versions of this project arrive on a working branch. On
GitHub, open a **pull request** into `main` and **merge** it, and the site
rebuilds itself.

**V · Validation.** The *release gate*: safety (no outside network, no scripts
from elsewhere), accessibility declarations, cover, and size. The same check runs
in the Studio, the command line, and GitHub. `npm run verify` audits the
running app in a real browser.

**W · Workflows.** `ci` (tests on every change), `publish` (books → `content`),
`pages` (the site), `app` and `android` (Cloudflare app deploys and the APK;
optional).

**X · Cross-site protection.** A Content Security Policy tells the browser what
each page may load. On GitHub Pages it ships inside the page; on Cloudflare as
headers.

**Y · Your data.** Local first: progress never leaves the device unless the
optional Supabase sync is switched on. Settings has export and delete.

**Z · Zips in `deploy/`.** Ready-made uploads: drag `single-origin.zip` into
Cloudflare Pages for a second free host; `storyframe-debug.apk` installs on
Android.

---

## 9. Commands

Run these in a terminal inside the `storyframe` folder.

| Command | What it does |
|---|---|
| `npm install` | Install (once, or after an update). |
| `npm start` | Build everything and serve it at <http://localhost:4173>. |
| `npm run dev` | Developer mode with live reload (app on :5173). |
| `npm test` | Run the 155 automated tests. |
| `npm run verify` | Browser audit (first: `npx playwright install chromium`). |
| `npm run doctor` | Check your computer's setup. |
| `npm run deploy:bundle` | Make the upload zips in `deploy/`. |
| `npm run storyframe -- new my-book` | Start a new book folder from the command line. |
| `npm run setup:pages -- <you>/<repo> --fix` | "Fix it for me" from the terminal (needs `GITHUB_TOKEN` set to a setup token). |

---

## 10. Keeping it running for free

| What | Cost and limits | What you do |
|---|---|---|
| GitHub Pages | $0. Site up to 1 GB, about 100 GB of visits per month, not for commercial sites. | Nothing. It never sleeps or expires. |
| GitHub Actions | $0 for public repositories. | Nothing. |
| Repository | Must stay **public** for free Pages. | — |
| Publishing token | Expires after 90 days. The site keeps running; only publishing stops. | Make a new one (Part 4). |
| Supabase (optional) | Free projects pause after a week without use. | Leave it off unless you need sign-ins. |
| Android | The APK is free to share. The Play Store charges a one-time $25. | — |

**Selling books later?** GitHub Pages is not for commercial sites. Move to
Cloudflare Pages (also free, commercial use allowed): [DEPLOY.md](DEPLOY.md),
steps 1–15. Your library moves with you; the `content` branch is the source of
truth for both.

---

## 11. Troubleshooting

| What you see | Fix |
|---|---|
| The **pages** run says "GitHub Pages is off" | Settings → Pages → Source: **GitHub Actions**, then run **pages** again. |
| Deploy fails: *"Branch main is not allowed to deploy to github-pages"* | Settings → **Environments** → **github-pages** → *Deployment branches* → add `main`. (Happens if Pages was switched on before `main` was the default.) |
| 404 at your address | Wait 2–5 minutes after the first green run. Settings → Pages should say *"Your site is live"*. |
| "Fix it for me" says a permission is missing | The setup token needs Contents, Actions, Pages, and Administration (write). Make a new one with the pre-filled link. |
| Test connection fails, or "connect GitHub first" | The token is for another repository, is missing a permission, or the tab was closed. Redo Part 4. |
| A **publish** run is red | Open it; the failed step says why (usually a check on the book). Fix the book and publish again. |
| A new book is missing after green runs | GitHub's cache: wait up to 10 minutes, then **Ctrl+F5**. |
| A linked book shows a blank page inside the app | That site refuses to be shown in other apps. Edit it and choose **new tab**. |
| A Google Drive book asks readers to sign in | In Drive: Share → *Anyone with the link* → Viewer. |
| `npm` is not recognised | Install Node.js (Part 2, Step 1), then open a **new** terminal. |
| Port 4173 is busy | Another copy is running; close that terminal, or stop it with Ctrl+C. |

---

## 12. What is tested, and what is not

**Tested before this zip was made:** 155 automated tests; type checks; a
browser audit of 116 checks against the normal build and 119 against the GitHub
Pages build under `/royal/` (books sealed in their frames, linked books, the
Studio, offline, contrast in light, dark, and high-contrast); and a fresh unpack
of this zip that installs, tests, and builds.

**Not tested from here:** publishing with your real GitHub token, your live Pages
site (it exists only after Part 3), Cloudflare deploys, the APK on a real phone,
and Supabase sync. The code for each is complete; [STATUS.md](STATUS.md) lists
exactly what is verified and how.

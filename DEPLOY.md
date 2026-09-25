# Deploying Storyframe for $0/month

A numbered, copy-paste guide for **Windows 11** (PowerShell or WSL — every
command below is identical in both). Nothing here needs a credit card.

What you end up with:

```
https://<your-app>.pages.dev        the reader app (+ Admin Studio at #/admin)
https://<your-stories>.pages.dev    the story library (immutable releases)
GitHub repository                   main = sources, content = published releases
GitHub Actions                      builds, validates, publishes, deploys
```

> **Short on time?** Do steps 1–2, then **Starter mode** in step 6 (one zip,
> one drag-and-drop) — a working library in about ten minutes. Come back for
> the rest when you want the Admin Studio to publish from the browser.

---

## Free tiers this relies on (checked 2026-09-24)

| service | what we use | free-tier limits that matter | source |
|---|---|---|---|
| Cloudflare Pages | two static projects | unlimited static requests and bandwidth; **25 MiB per file**; 20,000 files per site; `_headers` ≤ 100 rules; drag-and-drop upload ≤ 1,000 files; 500 builds/month (we do not use Pages builds — CI uploads with wrangler) | [limits](https://developers.cloudflare.com/pages/platform/limits/), [functions pricing](https://developers.cloudflare.com/pages/functions/pricing/), [direct upload](https://developers.cloudflare.com/pages/get-started/direct-upload/) |
| GitHub Actions | publish / app / ci / android workflows | public repos: free; private repos on GitHub Free: 2,000 minutes/month, 500 MB artifacts | [billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) |
| Supabase *(optional)* | accounts + cross-device sync | 500 MB database, 50,000 monthly active users, 5 GB egress, 500,000 function invocations, 2 active projects; **paused after 1 week of inactivity** | [pricing](https://supabase.com/pricing) |
| Cloudflare Zero Trust *(optional)* | Access in front of an admin copy | free for up to 50 users (third-party summaries; Cloudflare's own page did not state the number when checked) | [plans](https://www.cloudflare.com/plans/zero-trust-services/) |
| Cloudflare R2 *(upgrade path, not used)* | instant uploads without CI | 10 GB-month storage, 1M Class A / 10M Class B ops, free egress — **requires a payment method on file** to enable (Cloudflare community threads; the pricing page does not say) | [R2 pricing](https://developers.cloudflare.com/r2/pricing/) |
| App stores *(not needed)* | — | Google Play: one-time US$25; Apple Developer Program: US$99/year. The PWA and the sideloaded APK are free. | [Apple](https://developer.apple.com/programs/enroll/) |

---

## 1. Install the tools (once)

1. **Node.js 20 or newer** — download the LTS installer from <https://nodejs.org> and run it (defaults are fine).
2. **Git for Windows** — <https://git-scm.com/download/win> (defaults are fine).
3. Open **Windows Terminal → PowerShell** and check:

```powershell
node -v      # v20.x or newer
git --version
```

Using WSL instead? Install Node 20+ inside WSL (`nvm install 20`) and run
everything from the WSL shell. Do not mix: install and run from the same side.

## 2. Unzip, install, and try it locally

```powershell
cd $HOME\Downloads
Expand-Archive storyframe-v2.zip -DestinationPath storyframe
cd storyframe
npm install
npm run doctor        # checks Node, SDK, git, Playwright, deploy env
npm test              # contract tests
npm run build         # builds all books, publishes them locally, builds the app
npm run preview       # open http://localhost:4173
```

Optional — the full browser audit (downloads Chromium once, ~150 MB):

```powershell
npx playwright install chromium
npm run verify        # ends with "ALL … CHECKS PASSED"
```

For the two-origin developer setup with the local admin API: `npm run dev`
(app on :5173, story host on :4174).

## 3. Put it on GitHub

1. On <https://github.com/new> create a repository (e.g. `storyframe`).
   *Public* gets unlimited Actions minutes; *private* gets 2,000/month —
   both are plenty.
2. In PowerShell, in the project folder:

```powershell
git init
git add -A
git commit -m "Storyframe v2"
git branch -M main
git remote add origin https://github.com/<you>/storyframe.git
git push -u origin main
```

3. On GitHub, open the **Actions** tab. If asked, click **I understand my
   workflows, go ahead and enable them**.

## 4. The `content` branch (published releases)

Nothing to do by hand: the first run of the **publish** workflow creates it as
an orphan branch and commits every release there (step 8). It is written only
by CI.

*(Optional: `npm run content:init` seeds it from your local `npm run build`
instead.)*

## 5. A token for the Admin Studio (fine-grained PAT)

1. GitHub → your avatar → **Settings** → **Developer settings** →
   **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. **Token name:** `storyframe-admin`. **Expiration:** 90 days (you can renew).
3. **Repository access:** *Only select repositories* → pick your `storyframe` repo.
4. **Repository permissions:**
   - **Actions:** Read and write *(operator buttons + live run status)*
   - **Contents:** Read and write *(one commit per publish)*
   - **Metadata:** Read-only *(selected automatically)*
5. **Generate token** and copy it (starts with `github_pat_`). Keep it in a
   password manager. You paste it into the Admin Studio each browser session;
   it lives only in that tab's `sessionStorage` and is forgotten when the tab
   closes.

## 6. Create the Cloudflare Pages projects (drag and drop)

Sign up at <https://dash.cloudflare.com/sign-up> (free, no card).

First make the bundles (from your project folder):

```powershell
npm run deploy:bundle
```

This writes `deploy\app.zip`, `deploy\stories.zip`, and
`deploy\single-origin.zip` (the same files ship pre-built in the release zip).

### Starter mode — one project (fastest)

1. Dashboard → **Workers & Pages** → **Create application** → **Pages** →
   **Drag and drop your files** (Cloudflare may label it **Upload assets**).
2. Project name: `storyframe` (or anything free). Drop
   **`deploy\single-origin.zip`** → **Deploy site**.
3. Open `https://storyframe.pages.dev` (Cloudflare shows the exact URL; it adds
   a suffix if the name is taken). Done — every story runs in the opaque
   sandbox, which is the most locked-down posture.

### Production mode — two projects (separate origins)

Repeat the drag-and-drop twice:

| project name | upload | becomes |
|---|---|---|
| `storyframe-stories` | `deploy\stories.zip` | `https://storyframe-stories.pages.dev` |
| `storyframe-app` | `deploy\app.zip` | `https://storyframe-app.pages.dev` |

Write down the two URLs Cloudflare actually gives you. The pre-built bundles
assume exactly these names; if yours differ, the next steps fix it (CI
regenerates `config.json` and `_headers` from your values). To fix it by hand
instead:

```powershell
node scripts/deploy-bundle.mjs --zip --app-origin https://<your-app>.pages.dev --stories-origin https://<your-stories>.pages.dev --repo <you>/storyframe
```

…and upload the new zips as new deployments (project → **Create deployment**).

> Cloudflare: a Direct Upload project **cannot later be connected to Git**.
> That is fine — CI deploys to the same projects with `wrangler pages deploy`.

## 7. `config.json` — pointing the app at the library

The app reads `/config.json` at start-up:

```json
{ "storyOrigin": "https://storyframe-stories.pages.dev", "githubRepo": "<you>/storyframe" }
```

- Starter mode uses `"/stories-host"` (same origin).
- Never put a token in it — the file is public, and the app refuses keys that
  look like secrets.
- CI writes it for you from the variables in step 8.

## 8. Let GitHub deploy for you

### 8a. Cloudflare API token and account ID

1. Cloudflare dashboard → your profile → **API Tokens** → **Create Token** →
   **Custom token** → **Get started**.
2. Name: `storyframe-ci`. **Permissions:** `Account` · `Cloudflare Pages` · `Edit`.
   **Account resources:** *Include* → your account. **Continue to summary** →
   **Create Token** → copy it.
3. **Account ID:** shown on the **Workers & Pages** overview (right-hand side),
   or on any domain's **Overview** page under **API**.

### 8b. GitHub secrets and variables

GitHub → repo → **Settings** → **Secrets and variables** → **Actions**:

**Secrets** (tab *Secrets* → *New repository secret*):

| name | value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | the token from 8a |
| `CLOUDFLARE_ACCOUNT_ID` | your account ID |

**Variables** (tab *Variables* → *New repository variable*):

| name | example |
|---|---|
| `APP_PROJECT` | `storyframe-app` |
| `STORIES_PROJECT` | `storyframe-stories` |
| `APP_ORIGIN` | `https://storyframe-app.pages.dev` |
| `STORIES_ORIGIN` | `https://storyframe-stories.pages.dev` |

### 8c. First runs

1. **Actions** → **publish** → **Run workflow** → action `publish`, slug
   *(empty)*, channel `production` → **Run**. This creates the `content` branch,
   publishes all three books straight to production, and deploys the stories
   project. (Later publishes go to **beta** first.)
2. **Actions** → **app** → **Run workflow**. This deploys the app with the
   right `config.json` and a CSP that names your stories origin.
3. Open your app URL. Three books on the shelf.

## 9. Open the Admin Studio

1. Go to `https://<your-app>.pages.dev/#/admin/connect`.
2. Repository: `<you>/storyframe` (pre-filled from `config.json`), branch
   `main`, paste the token from step 5 → **Save** → **Test connection** →
   "✓ Connected … with write access".
3. **Admin** now appears in the main navigation for this tab.

## 10. Publish your first Quick Book

1. **Admin → New book → Start a new book → Quick Book.**
2. Drop a `.md` or `.docx` file (or type in the box). Headings (`##`) become
   chapters; see the directive cheat-sheet under the editor and
   `docs/BOOK-AUTHORING.md`.
3. **Manifest:** title, tagline, theme, rating, warnings.
4. **Cover:** upload one, or generate one (the contrast check must pass).
5. **Accessibility:** confirm the promises honestly.
6. **Validate:** the exact release gate CI runs. Fix anything red.
7. **Preview:** your book in an isolated frame; try *Text 2×*, *Motion: none*,
   *Dark*, the phone size.
8. **Publish:** *Publish v0.1.0 to beta*. The page shows the commit, the CI run,
   and waits until the release appears in the registry.
9. **Preview beta in the app**, then on the book's release page:
   **Promote beta to production** → confirm. The run's status updates live.

Readers now see it on the shelf. Rollback and the kill switch live on the same page.

## 11. (Optional) Accounts and cross-device sync with Supabase

Status: code-complete, **not verified against a live project** in this
repository (see `STATUS.md`). Local-first stays the default either way.

1. <https://supabase.com> → **New project** (free).
2. **SQL Editor** → run, in order, the files in `supabase/migrations/`
   (`0001_core.sql` … `0004_import_and_sync.sql`).
3. **Authentication → Providers → Email**: enabled (magic link).
   **Authentication → URL Configuration**: *Site URL* = your app URL; add it to
   *Redirect URLs*.
4. Deploy the functions (from the project folder):

```powershell
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase secrets set STORIES_ORIGIN=https://<your-stories>.pages.dev APP_ORIGIN=https://<your-app>.pages.dev
npx supabase functions deploy progress-commit progress-import
```

5. GitHub variables: `SUPABASE_URL` (Project Settings → API → URL) and
   `SUPABASE_ANON_KEY` (the **anon public** key — never the service role key).
   Re-run the **app** workflow.
6. Settings → Account now offers a sign-in link.

Free projects **pause after a week without traffic**; resume them from the
Supabase dashboard. Reading and saving on each device keep working while
paused — only sync waits.

## 12. (Optional) An Android app

- **PWA (free, recommended):** open the app in Chrome on Android → menu →
  **Install app** (Storyframe also offers it after you start a story). On
  iPhone/iPad: Safari → Share → **Add to Home Screen**.
- **Debug APK (free, sideloaded):** Actions → **android** → **Run workflow** →
  download the `storyframe-debug-apk` artifact → copy to the phone → allow
  *Install unknown apps* for your file manager → install. With
  `STORIES_ORIGIN` set, the APK reads your live library; without it, the
  library is bundled inside the APK. For the APK to read a separate stories
  origin, regenerate the stories bundle with `--with-android` so CORS and
  `frame-ancestors` include the WebView origin `https://localhost`.
- **Stores:** Google Play needs a one-time US$25 developer account; Apple's App
  Store needs the US$99/year Developer Program. A Trusted Web Activity
  (Bubblewrap, `npx @bubblewrap/cli init --manifest https://<your-app>.pages.dev/manifest.webmanifest`)
  is the lighter way to list the PWA on Google Play.

## 13. Hardening (optional)

- **The token is the real gate.** Without it the Admin Studio is read-only.
- **Cloudflare Access** cannot protect `#/admin` on the public reader URL — the
  `#…` part never reaches a server. Instead, create a third Pages project (e.g.
  `storyframe-admin`) with the same `app` bundle, protect that whole hostname
  with Access (Zero Trust → Access → Applications → *Self-hosted* →
  `storyframe-admin.pages.dev`, policy: your email), and do admin work there.
- Tighten CORS/CSP to exact origins by setting `APP_ORIGIN`/`STORIES_ORIGIN`
  (CI does this automatically).
- Give the PAT the shortest expiration you can live with.

## 14. Troubleshooting

| symptom | cause | fix |
|---|---|---|
| Yellow banner "story library … could not be reached" | `storyOrigin` wrong, or the stories project has no deployment | check `https://<stories>/registry.json` opens; fix `STORIES_ORIGIN` and re-run **app** |
| Console: *blocked by CORS policy* | stories `_headers` name a different app origin | set `APP_ORIGIN` exactly (scheme + host, no slash) and re-run **publish** with action `redeploy` |
| Console: *Refused to frame … Content Security Policy* | the app CSP's `frame-src` does not list your stories origin | set `STORIES_ORIGIN` and re-run **app** (the pre-built zip allows any `*.pages.dev`) |
| The story frame stays blank | handshake timed out (diagnostic id shown) — often a stale service worker after an update | reload once; the app offers "Update now" when a new version is ready. Still blank: open the package URL directly to see the story's own error |
| "integrity check FAILED — download discarded" | the served file differs from `integrity.json` — a proxy rewrote it, or files were edited by hand on the host | never edit release folders; redeploy with action `redeploy` |
| **publish** fails at *validate* | the release gate refused the book | the run summary lists each issue with a fix line; the Admin Studio's Validate step shows the same |
| **publish** fails at *promote* with "stateSchemaVersion" | the new edition renamed/removed IDs | add a migration (`docs/BOOK-AUTHORING.md` §10), publish again, promote |
| Deploy step says "secrets … not set" | step 8 incomplete | add both secrets and the `*_PROJECT` variables |
| wrangler: *project not found* | project name typo | `APP_PROJECT`/`STORIES_PROJECT` must match the Cloudflare project names exactly |
| Admin: "GitHub 403" | token lacks Actions or Contents write, or covers another repo | regenerate per step 5 |
| Admin: "the branch moved while publishing" | someone pushed at the same moment | click Publish again (it rebases onto the new head) |
| `npm run build` on Windows says "npm not found" | Node installed after the terminal opened | close and reopen Windows Terminal |

## 15. Upgrade path (not built): instant uploads with R2 + a Worker

To publish without waiting for a CI run, a Worker could accept the Admin
Studio's upload, run the same `@storyframe/publishing` validator, write the
immutable release to an R2 bucket, and update `registry.json`. R2's free tier
is generous (10 GB-month, free egress) but **requires a payment method on
file**, so it is documented rather than built. The CLI + CI path would remain
the source of truth for the audit log.

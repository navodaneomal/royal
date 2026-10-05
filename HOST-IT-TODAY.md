# Host it today

From a zip on your computer to a live library with your own books: about
15 minutes, $0, with only a GitHub account. (The complete, click-by-click
version, with how everything works, is [START-HERE.md](START-HERE.md).) Every command works the same in
Windows PowerShell, WSL, macOS, and Linux.

---

## 1. Try it on your computer (5 minutes)

You need **Node.js 20 or newer** (<https://nodejs.org>, the LTS installer).

```bash
cd storyframe          # the unzipped folder
npm install
npm start              # builds everything, then serves it
```

Open **<http://localhost:4173>**. Things to try:

| Try this | What should happen |
|---|---|
| The shelf | Four books. *Alice’s Adventures in Wonderland* is a **linked book**: tap it and Project Gutenberg opens in a new tab. |
| *Neon Horizon* → Start reading | A green terminal story runs. Reload the page and it remembers where you were. |
| **Add a book** → *Start from a template* → *The Locked Study* → **Read it now** | Your own book, made in seconds, opens in its sealed reader. |
| **Add a book** → **Link a book hosted elsewhere** → paste any link | A card with a cover appears. **Add to my shelf**, then tap it and the link opens. |
| Settings → *Accent colour* | The whole app re-tints. |
| A book page → **Share** | A QR code. Scan it with your phone (works once the site is online). |

## 2. Put it online, free (5 minutes)

The project is already in your GitHub repository (`navodaneomal/royal`).
Keep the app running from step 1, then:

1. Open **<http://localhost:4173/#/admin/hosting>** (Studio → Hosting).
2. Repository: `navodaneomal/royal`.
3. Click **Create one (pre-filled, expires in 1 day)** next to *Setup token*. On
   GitHub, choose **Only select repositories → royal**, then **Generate token**.
   Copy it and paste it into *Setup token*.
4. **Check** → **Fix it for me**.

It creates a `main` branch from your current code, makes it the default,
turns on GitHub Pages, and starts the first deployment. About two minutes
later your library is live:

| | |
|---|---|
| Reader app | **https://navodaneomal.github.io/royal/** |
| Studio | https://navodaneomal.github.io/royal/#/admin/connect |
| Add a book | https://navodaneomal.github.io/royal/#/add |

Prefer the terminal? `GITHUB_TOKEN=github_pat_… npm run setup:pages -- navodaneomal/royal --fix`
does the same.

## 3. Add your books from anywhere (2 minutes per book)

1. On the Hosting page, create the **everyday publishing token** (Contents +
   Actions, 90 days; choose *Only select repositories → royal* again).
2. Open **https://navodaneomal.github.io/royal/#/admin/connect** and paste it.
   The repository and branch are already filled in.
3. Then pick one:
   - **Studio → Link a book**: for books already hosted somewhere (a website,
     PDF, Google Drive/Docs, YouTube, a flipbook). Paste the link, add a cover
     (or keep the designed one), then **Publish for everyone**. Got a list?
     Use **Many at once** and paste one book per line: `Title | link`.
   - **Studio → Publish a book**: write, paste, or drop a `.docx` / `.txt` /
     `.md`, then **Publish for everyone**.
4. Leave **“Put it on the shelf right away”** ticked. The progress panel shows
   each step; the book appears on the live site in a few minutes.

## 4. Check it really works (on your phone too)

| Check | Expected |
|---|---|
| Open the reader app on your phone | Tab bar at the bottom; **Install** puts it on your home screen. |
| Tap a linked book | It opens its own site (or, for embeddable links, inside the app with an “Open on …” button). |
| Tap a Storyframe book, close the tab, come back | “Continue reading” takes you to the right chapter. |
| Offline centre → *Download all*, then airplane mode | Downloaded books still open. |
| GitHub → your repo → **Actions** | Green runs for *publish* and *pages* after each book. |

## If something goes wrong

| Symptom | Fix |
|---|---|
| Deploy fails: “Branch main is not allowed to deploy to github-pages” | Settings → Environments → github-pages → Deployment branches → add `main` (happens if Pages was switched on before `main` became the default). |
| “Fix it for me” says a permission is missing | The setup token needs Contents, Actions, Pages, and Administration (write) for `royal`. Make a new one with the pre-filled link. |
| The site is not updated yet | GitHub Pages caches for up to 10 minutes. Check **Actions → pages** for a green run. |
| An embedded linked book shows a blank page | That site refuses to be shown inside other apps. Edit the link and choose **Open the site in a new tab**. |
| A Google Drive book will not open | In Drive: Share → *Anyone with the link* → Viewer. |
| Publishing says “connect GitHub first” | The publishing token lives only in that browser tab. Paste it again on the Studio’s Connection page. |
| Updates I (or Claude) push later do not appear | New work arrives on a working branch; merge it into `main` on GitHub (Pull requests → New). |

More depth: [START-HERE.md](START-HERE.md) (everything, A to Z) · [DEPLOY.md](DEPLOY.md) (every option, including Cloudflare) ·
[docs/BOOK-AUTHORING.md](docs/BOOK-AUTHORING.md) (making books) ·
[STATUS.md](STATUS.md) (what is verified, and how).

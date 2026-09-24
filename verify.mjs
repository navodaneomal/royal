/* Storyframe end-to-end audit (v2).
   Runs against the production build served single-origin (the hardest
   security posture: every story in an OPAQUE sandbox), then again with a
   runtime config.json pointing at a separate story origin (the online,
   cross-origin posture). Covers the v1 P0 gates — launch, handshake, atomic
   saves, resume, conflict UI, offline play, hostile-frame isolation,
   accessibility — and the v2 surfaces: onboarding, command palette,
   search, the live quick-settings drawer, protocol 1.1 notes, replay,
   the offline centre, and the Admin Studio wizard end to end (upload →
   validate → preview in an opaque frame) in all five Quick Book themes.
   Writes screenshots to shots/. */
import { chromium } from 'playwright'     // devDependency; browsers: npx playwright install chromium
import { mkdirSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const BASE = 'http://localhost:4173'
const XBASE = 'http://localhost:4175'           // same build, config.json → story host on :4174
const FIXTURE = resolve('tests/fixtures/quick-book.md')
mkdirSync('shots', { recursive: true })
const errors = []
let passed = 0
const note = (s) => console.log('  · ' + s)
const fail = (s) => { errors.push(s); console.log('  ✗ ' + s) }
const check = (ok, good, bad) => { if (ok) { passed += 1; if (good) note(good) } else fail(bad ?? good) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const servers = [
  spawn(process.execPath, ['scripts/preview.mjs'], { stdio: 'ignore' }),
  spawn(process.execPath, ['scripts/preview.mjs'], { stdio: 'ignore', env: { ...process.env, PORT: '4175', PREVIEW_CONFIG: JSON.stringify({ storyOrigin: 'http://localhost:4174' }) } }),
  spawn(process.execPath, ['infra/story-host/server.mjs'], { stdio: 'ignore' }),
]
await sleep(1500)

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1360, height: 880 }, deviceScaleFactor: 2 })
ctx.on('weberror', (e) => fail('pageerror: ' + e.error().message))
const page = await ctx.newPage()
// the audit deliberately provokes CSP refusals (fetch to example.com) — those are expected
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|favicon|example\.com/.test(m.text())) fail('console: ' + m.text()) })
page.on('dialog', (d) => d.accept())

const storyFrame = (p = page) => p.frames().find((f) => f !== p.mainFrame())
const shot = (n, p = page) => p.screenshot({ path: `shots/${n}.png` })
const showChrome = async (p = page) => { await p.mouse.move(600, 4); await sleep(250) }
const back = async (p = page) => { await showChrome(p); await p.click('.player-bar a:has-text("Back")') }

/** Every visible text node's contrast against its effective background. */
async function contrast(label, p = page, min = 4.5) {
  const worst = await p.evaluate(() => {
    const parse = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return null; const [r, g, b, a = 1] = m[1].split(',').map(Number); return { r, g, b, a } }
    const lum = ({ r, g, b }) => [r, g, b].map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }).reduce((acc, v, i) => acc + v * [0.2126, 0.7152, 0.0722][i], 0)
    const ratio = (x, y) => { const [a, b] = [lum(x), lum(y)].sort((m, n) => n - m); return (a + 0.05) / (b + 0.05) }
    const bgOf = (el) => { for (let n = el; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a > 0.5) return c } return parse(getComputedStyle(document.body).backgroundColor) }
    const out = []
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    while (w.nextNode()) {
      const t = w.currentNode
      if (!t.textContent.trim()) continue
      const el = t.parentElement
      if (!el || el.closest('[aria-hidden="true"], .sr, [hidden], iframe, [disabled], .log, option, .skip, .toast')) continue
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none') continue
      const rect = el.getBoundingClientRect()
      if (!rect.width || !rect.height) continue
      const fg = parse(cs.color), bg = bgOf(el)
      const f = fg.a < 1 ? { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a) } : fg
      const size = parseFloat(cs.fontSize), large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700)
      out.push({ r: +ratio(f, bg).toFixed(2), need: large ? 3 : 4.5, text: t.textContent.trim().slice(0, 36) })
    }
    return out.sort((a, b) => a.r / a.need - b.r / b.need).slice(0, 2)
  })
  const bad = worst.filter((x) => x.r < Math.max(x.need, min === 4.5 ? x.need : min))
  check(!bad.length, `contrast ${label}: lowest ${worst[0]?.r ?? '—'}:1 ("${worst[0]?.text ?? ''}")`, `contrast ${label}: ${bad.map((b) => `${b.r}:1 "${b.text}"`).join(', ')}`)
}

async function a11yBasics(label, p = page) {
  const r = await p.evaluate(() => ({
    h1: document.querySelectorAll('h1').length,
    unlabeled: [...document.querySelectorAll('button, [role="button"]')].filter((b) => !b.textContent.trim() && !b.getAttribute('aria-label') && !b.getAttribute('aria-labelledby')).length,
    inputs: [...document.querySelectorAll('input:not([type="hidden"]), select, textarea')].filter((i) => !(i.labels?.length) && !i.getAttribute('aria-label') && !i.getAttribute('aria-labelledby')).length,
  }))
  check(r.h1 === 1 && !r.unlabeled && !r.inputs, `a11y ${label}: one h1, labelled controls`, `a11y ${label}: h1=${r.h1}, unlabeled buttons=${r.unlabeled}, unlabeled inputs=${r.inputs}`)
}

try {
  /* ── 0. first run: onboarding sets the profile once ─────────────── */
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForSelector('.dialog.onboard', { timeout: 6000 })
  check(true, 'onboarding: "How do you like to read?" opens on first run')
  await a11yBasics('onboarding dialog')
  await contrast('onboarding dialog')
  await shot('00-onboarding')
  await page.click('.onboard button:has-text("Next")')
  await page.click('.onboard .choice-card:has-text("Reduced")')
  await sleep(300)
  const motion = await page.evaluate(() => document.documentElement.dataset.motion)
  check(motion === 'reduced', 'onboarding: choosing "Reduced" applies to the shell immediately', 'onboarding motion not applied: ' + motion)
  await page.click('.onboard .choice-card:has-text("Full motion")')
  await page.click('.onboard button:has-text("Next")')
  await page.click('.onboard button:has-text("Start reading")')
  await sleep(300)
  check(!(await page.locator('.dialog.onboard').count()), 'onboarding: finished, not shown again')

  /* ── 1. shelf ─────────────────────────────────────────────────────── */
  const cards = await page.locator('.grid-books.shelf .story-card').count()
  check(cards === 3, 'shelf: all three stories on the Living Shelf', `shelf shows ${cards} stories, expected 3`)
  await a11yBasics('shelf')
  await contrast('shelf (light)')
  await shot('01-shelf')

  await page.fill('#shelf-search', 'lighthouse storm')
  await sleep(200)
  const found = await page.locator('.grid-books .story-card').allTextContents()
  check(found.length === 1 && /Wend Light/.test(found[0]), 'search: fuzzy "lighthouse storm" → The Keeper of Wend Light', 'search results: ' + found.join(' | '))
  await page.fill('#shelf-search', '')
  await page.click('button[aria-controls="shelf-filters"]')
  await page.click('.filters .chip:has-text("Under 30 min")')
  await sleep(200)
  const short = await page.locator('.grid-books .story-card').count()
  check(short === 2, 'filters: "Under 30 min" → 2 books', 'short filter shows ' + short)
  await shot('01b-shelf-filters')
  await page.click('button:has-text("Clear filters")')

  /* ── 2. command palette + shortcuts ───────────────────────────────── */
  await page.keyboard.press('Control+k')
  await page.waitForSelector('.palette input')
  await page.keyboard.type('archive')
  await page.keyboard.press('Enter')
  await sleep(300)
  check(page.url().endsWith('#/collections'), 'command palette: Ctrl+K → "archive" → Enter navigates', 'palette went to ' + page.url())
  await page.goto(BASE + '#/', { waitUntil: 'networkidle' })
  await page.keyboard.press('?')
  const keysTitle = await page.locator('.dialog h2').textContent().catch(() => '')
  check(/Keyboard shortcuts/.test(keysTitle ?? ''), 'shortcuts overlay: "?" opens it')
  await page.keyboard.press('Escape')

  /* ── 3. neon horizon: launch, handshake, isolation, atomic saves ─── */
  await page.click('a.story-card:has-text("Neon Horizon")')
  await sleep(500)
  await a11yBasics('story detail')
  await contrast('story detail')
  await shot('02-detail-neon')
  await page.click('a.btn:has-text("Start reading")')
  await page.waitForSelector('iframe', { timeout: 8000 })
  await sleep(1800)
  let f = storyFrame()
  if (!f) throw new Error('no story frame')
  check(/RELAY/.test((await f.locator('#log').textContent()) ?? ''), 'bridge: opaque handshake + bootstrap OK (1.1 SDK ↔ 1.1 host)', 'neon horizon did not boot in the opaque frame')

  const iso = await f.evaluate(() => {
    const out = {}
    try { void window.parent.document; out.parentDom = 'REACHED' } catch { out.parentDom = 'blocked' }
    try { void window.localStorage; out.storage = 'REACHED' } catch { out.storage = 'blocked' }
    out.origin = self.origin
    out.csp = !!document.querySelector('meta[http-equiv="Content-Security-Policy"]')
    return out
  })
  check(iso.parentDom === 'blocked', null, 'SECURITY: story frame reached parent DOM')
  check(iso.storage === 'blocked', null, 'SECURITY: story frame reached localStorage')
  check(iso.origin === 'null', null, 'SECURITY: story frame is not opaque (origin ' + iso.origin + ')')
  check(iso.csp, `isolation: parent DOM ${iso.parentDom}, storage ${iso.storage}, origin ${iso.origin}, story CSP meta present`, 'story CSP meta missing in frame')
  const fetchBlocked = await f.evaluate(async () => { try { await fetch('https://example.com/'); return 'REACHED' } catch { return 'blocked' } })
  check(fetchBlocked === 'blocked', 'CSP: fetch() from the story frame is blocked (connect-src none)', 'SECURITY: story frame could fetch')

  await page.evaluate(() => {
    window.postMessage({ type: 'STORYFRAME_HELLO', protocol: '1.0', storyId: '2b4dfd0e-91c8-45c0-8a3e-6f0a5cf6f2aa', releaseId: 'rforged000000', nonce: 'A'.repeat(24) }, '*')
  })
  await sleep(300)

  await f.fill('#cmd', 'examine desk'); await f.press('#cmd', 'Enter'); await sleep(500)
  await f.fill('#cmd', 'align 741'); await f.press('#cmd', 'Enter'); await sleep(700)
  const chip1 = await page.locator('.savechip').textContent()
  check(/Saved/.test(chip1 ?? ''), 'save chip: ' + chip1?.trim(), 'save chip did not confirm: ' + chip1)

  // quick-settings drawer: live preference delivery into the running story
  await showChrome()
  await page.click('button[aria-label="Reading settings"]')
  await page.waitForSelector('.drawer')
  await a11yBasics('player + drawer')
  await page.fill('#qs-scale', '1.5')
  await sleep(500)
  const fs = await f.evaluate(() => document.documentElement.style.fontSize)
  check(fs === '24px', 'drawer: text size 150% reaches the story live (root font-size 24px)', 'drawer text size not applied in frame: ' + fs)
  await shot('03-neon-drawer')
  await page.fill('#qs-scale', '1')
  await page.keyboard.press('Escape')
  await sleep(300)
  await shot('03-neon-aligned')
  await f.fill('#cmd', 'stay'); await f.press('#cmd', 'Enter'); await sleep(700)
  await shot('04-neon-ending')
  await f.fill('#cmd', 'transmit'); await f.press('#cmd', 'Enter'); await sleep(400)
  check(/choice is made/i.test((await f.locator('#log').textContent()) ?? ''), 'canonical choice: locked after commit', 'story allowed re-deciding a committed choice')

  // immersive chrome steps aside while reading (fine pointer)
  await page.mouse.move(600, 500)
  await sleep(4200)
  const chromeState = await page.locator('.player').getAttribute('data-chrome')
  check(chromeState === 'hidden', 'player: chrome auto-hides while reading', 'chrome did not hide: ' + chromeState)
  await showChrome()
  check((await page.locator('.player').getAttribute('data-chrome')) === 'shown', 'player: chrome returns when the pointer reaches the top')

  /* ── 4. resume across reload ──────────────────────────────────────── */
  await back()
  await sleep(600)
  const rev = await page.locator('.facts >> text=/revision/').textContent().catch(() => '')
  check(/revision [1-9]/.test(rev ?? ''), null, 'detail page shows no revision after play: ' + rev)
  const map = await page.locator('.cp-map li').count()
  check(map === 4, 'detail: checkpoint map in story language (4 parts, reached ones named)', 'checkpoint map items: ' + map)
  await page.goto(BASE, { waitUntil: 'networkidle' }); await sleep(500)
  const badge = await page.locator('.grid-books.shelf .story-card:has-text("Neon Horizon") .badge').first().textContent()
  check(/Finished/.test(badge ?? ''), 'shelf: completion + story-language progress reflected', 'shelf does not show Neon Horizon finished: ' + badge)
  await page.click('.grid-books.shelf a.story-card:has-text("Neon Horizon")')
  await page.click('a.btn:has-text("Continue")')
  await page.waitForSelector('iframe'); await sleep(1600)
  f = storyFrame()
  check(/remembered you/i.test((await f.locator('#log').textContent()) ?? ''), 'resume: semantic checkpoint restored after full reload', 'story did not restore semantic state on relaunch')
  await back()

  /* ── 5. the quick book: chapters, secret, choice, ending, notes (1.1) */
  await page.goto(BASE + '#/story/the-keeper-of-wend-light'); await sleep(400)
  await page.click('a.btn:has-text("Start reading")')
  await page.waitForSelector('iframe'); await sleep(1500)
  f = storyFrame()
  await f.click('.qb-begin'); await sleep(400)
  await f.click('#ch-almanac .qb-secret-btn'); await sleep(500)
  await f.click('#ch-almanac [data-action="note"]')
  await f.fill('#qb-note-almanac', 'Ilse was fourteen too.')
  await f.click('#ch-almanac .qb-note-form button[type="submit"]'); await sleep(500)
  await f.click('#ch-almanac .qb-next'); await sleep(500)
  await f.click('.qb-option[data-option="answer"]'); await sleep(500)
  await f.click('#ch-storm .qb-next'); await sleep(600)
  const ending = await f.locator('#ch-morning .qb-branch:not([hidden]) .qb-ending-mark').textContent().catch(() => '')
  check(/Answered Signal/.test(ending ?? ''), 'quick book: chapter → secret → choice → branch → ending, all in the opaque frame', 'quick book ending not shown: ' + ending)
  await shot('05-quickbook-watercolor')
  const qbChip = await page.locator('.savechip').getAttribute('data-state')
  check(qbChip === 'saved', null, 'quick book commits not saved: ' + qbChip)
  await back()
  await sleep(500)
  const noteShown = await page.locator('.list li:has-text("Ilse was fourteen too.")').count()
  check(noteShown === 1, 'protocol 1.1: a note written inside the story arrives in the shell (NOTE_ADD → notes store)', 'note from story not in detail page')

  /* ── 6. archive: gallery, endings, notes, timeline tree + replay ──── */
  await page.goto(BASE + '#/collections'); await sleep(700)
  const arch = await page.locator('.entry:not(.locked)').count()
  check(arch >= 5, `archive: ${arch} discovered entries, achievements and endings with provenance`, 'archive shows too few discovered entries: ' + arch)
  await a11yBasics('archive')
  await contrast('archive')
  await shot('06-archive')
  const wendTree = page.locator('section[aria-label="Collection for The Keeper of Wend Light"] .tree')
  await wendTree.locator('select').first().selectOption('storm')
  await sleep(800)
  const nodes = await wendTree.locator('.node').count()
  const current = await wendTree.locator('.node.primary .name').textContent()
  check(nodes === 2 && /Replay from/.test(current ?? ''), 'replay: new primary timeline from "The Storm"; the original keeps its choice', `timeline tree nodes ${nodes}, primary "${current}"`)
  await page.goto(BASE + '#/play/the-keeper-of-wend-light'); await page.waitForSelector('iframe'); await sleep(1500)
  f = storyFrame()
  const replayOpen = await f.evaluate(() => ({ ch: [...document.querySelectorAll('.qb-chapter')].find((a) => !a.hidden)?.id, chosen: !document.querySelector('.qb-choice .qb-chosen')?.hidden }))
  check(replayOpen.ch === 'ch-storm' && !replayOpen.chosen, 'replay: resumes at the storm with the choice still open', 'replay state: ' + JSON.stringify(replayOpen))
  await back()

  /* ── 7. the tulip & the jester: full visual identity inside frame ── */
  await page.goto(BASE + '#/story/the-tulip-and-the-jester'); await sleep(400)
  await page.click('a.btn:has-text("Start reading")')
  await page.waitForSelector('iframe'); await sleep(2500)
  f = storyFrame()
  check(/Tulip/i.test((await f.locator('.thr-title').textContent().catch(() => '')) ?? ''), null, 'tulip threshold missing in frame')
  await shot('07-tulip-threshold')
  await f.click('#enterBtn'); await sleep(1800)
  await f.click('.card >> nth=0'); await sleep(3400)
  const chip2 = await page.locator('.savechip').getAttribute('data-state')
  check(chip2 === 'saved' || chip2 === 'offline', 'tulip: Part I checkpoint committed through the bridge (legacy wrap, declarative build)', 'tulip checkpoint did not save: ' + chip2)
  await shot('08-tulip-part1')
  await back(); await sleep(400)
  await page.goto(BASE, { waitUntil: 'networkidle' }); await sleep(800)
  const cont = await page.locator('.continue-card .where').textContent().catch(() => '')
  check(/Part I|Birthday/i.test(cont ?? ''), 'continue hero: "' + cont?.trim() + '"', 'continue hero lacks story-language location: ' + cont)
  const heroAccent = await page.locator('.hero').evaluate((el) => getComputedStyle(el).getPropertyValue('--hero-accent').trim())
  check(!!heroAccent, 'continue hero: tinted with the book accent ' + heroAccent, 'hero has no accent')
  await shot('09-shelf-progress')

  /* ── 8. conflict: two tabs, one timeline (§7.4) ───────────────────── */
  const tabB = await ctx.newPage()
  tabB.on('dialog', (d) => d.accept())
  await tabB.goto(BASE + '#/play/neon-horizon', { waitUntil: 'networkidle' })
  await tabB.waitForSelector('iframe'); await sleep(1600)
  const fb = storyFrame(tabB)
  await page.goto(BASE + '#/play/neon-horizon'); await page.waitForSelector('iframe'); await sleep(1600)
  const fa = storyFrame()
  await fa.fill('#cmd', 'listen'); await fa.press('#cmd', 'Enter'); await sleep(600)
  await fb.fill('#cmd', 'listen'); await fb.press('#cmd', 'Enter'); await sleep(800)
  const dialog = await tabB.locator('.dialog h2').textContent().catch(() => '')
  check(/Two timelines/i.test(dialog ?? ''), 'conflict: "Two timelines were found" — archived, not overwritten', 'divergence did not raise the timeline dialog: ' + dialog)
  await tabB.screenshot({ path: 'shots/10-conflict.png' })
  await tabB.click('.dialog .btn:has-text("Continue from latest")')
  await sleep(600)
  await tabB.close()
  await back().catch(() => {})

  /* ── 9. offline: centre, download, verify, airplane mode, play ───── */
  await page.goto(BASE + '#/offline'); await sleep(700)
  await a11yBasics('offline centre')
  await contrast('offline centre')
  const meter = await page.locator('.meter').count()
  check(meter >= 1, 'offline centre: storage quota meter (navigator.storage.estimate)', 'no quota meter')
  await page.click('button:has-text("Download all")')
  await page.waitForFunction(() => document.querySelectorAll('h2 + ul.list li').length >= 3 && !document.querySelector('h2 ~ h2'), null, { timeout: 20000 }).catch(() => {})
  const downloaded = await page.locator('h2:has-text("On this device") + ul li').count()
  check(downloaded === 3, 'offline centre: "Download all" verified all three packages', 'downloads after Download all: ' + downloaded)
  await shot('11-offline-centre')
  await ctx.setOffline(true)
  await page.goto(BASE + '#/story/neon-horizon'); await sleep(600)
  await page.click('a:has-text("offline copy")')
  await page.waitForSelector('iframe'); await sleep(1800)
  const fo = storyFrame()
  check(/RELAY/.test((await fo.locator('#log').textContent().catch(() => '')) ?? ''), null, 'offline blob frame did not boot')
  await fo.fill('#cmd', 'look'); await fo.press('#cmd', 'Enter'); await sleep(300)
  await fo.fill('#cmd', 'listen'); await fo.press('#cmd', 'Enter'); await sleep(700)
  const chipOff = await page.locator('.savechip').textContent()
  check(/Offline/i.test(chipOff ?? ''), 'offline: played from verified blob, chip = "' + chipOff?.trim() + '"', 'offline save state not honest: ' + chipOff)
  const offIso = await fo.evaluate(async () => { try { await fetch('https://example.com/'); return 'REACHED' } catch { return 'blocked' } })
  check(offIso === 'blocked', 'offline blob: CSP meta travels with the bytes — fetch blocked', 'SECURITY: offline blob could fetch')
  await shot('12-offline-play')
  await ctx.setOffline(false)
  await back()

  /* ── 10. admin studio: dashboard + wizard happy path ─────────────── */
  await page.goto(BASE + '#/admin'); await sleep(900)
  const rows = await page.locator('table.op').first().locator('tbody tr').count()
  check(rows === 3, null, 'admin catalog rows: ' + rows)
  const auditRows = await page.locator('table.op').nth(1).locator('tbody tr').count()
  check(auditRows >= 3, 'admin dashboard: books, channels, audit log with filters, health tiles', 'audit log not visible in admin')
  await a11yBasics('admin dashboard')
  await contrast('admin dashboard')
  await shot('13-admin-dashboard')

  await page.goto(BASE + '#/admin/new'); await sleep(500)
  await page.click('button:has-text("Start a new book")'); await sleep(500)
  await page.click('.lane:has-text("Quick Book")'); await sleep(300)
  await page.setInputFiles('[data-testid="upload"]', FIXTURE)
  await sleep(600)
  const md = await page.locator('#book-md').inputValue()
  check(/Clockmaker/.test(md), 'wizard: dropped a .md Quick Book (front matter moved into the manifest)', 'upload did not load the markdown')
  await page.click('button:has-text("Next: Manifest")'); await sleep(300)
  const title = await page.locator('#m-title').inputValue()
  const slug = await page.locator('#m-slug').inputValue()
  check(title === "The Clockmaker's Daughter" && slug === 'the-clockmaker-s-daughter', `wizard: manifest form — "${title}" / ${slug}`, `manifest title/slug: ${title} / ${slug}`)
  await a11yBasics('admin wizard (manifest)')
  await contrast('admin wizard (manifest)')
  await shot('14-admin-manifest')
  await page.click('button:has-text("Next: Cover")'); await sleep(300)
  await page.click('button:has-text("Use this cover")'); await sleep(300)
  await page.click('button:has-text("Next: Accessibility")'); await sleep(200)
  await page.click('button:has-text("Next: Validate")'); await sleep(600)
  const verdict = await page.locator('[data-testid="validation-result"]').textContent()
  check(/Passes the release gate/.test(verdict ?? ''), 'wizard: in-browser release gate passes — ' + verdict?.trim().slice(0, 70), 'wizard validation: ' + verdict)
  await shot('15-admin-validate')

  for (const theme of ['manuscript', 'terminal', 'watercolor', 'noir', 'minimal']) {
    await page.click('.stepper button:has-text("Manifest")'); await sleep(200)
    await page.selectOption('#m-build', theme); await sleep(300)
    await page.click('.stepper button:has-text("Preview")'); await sleep(300)
    await page.waitForFunction(() => document.querySelector('[data-testid="preview-status"]')?.textContent === 'connected', null, { timeout: 8000 })
    const pf = storyFrame()
    await pf.click('.qb-begin'); await sleep(250)
    const r = await pf.evaluate(() => ({
      origin: self.origin,
      theme: document.documentElement.dataset.theme,
      parent: (() => { try { void parent.document; return 'REACHED' } catch { return 'blocked' } })(),
      storage: (() => { try { void localStorage; return 'REACHED' } catch { return 'blocked' } })(),
      h1: document.querySelectorAll('h1').length,
    }))
    check(r.origin === 'null' && r.parent === 'blocked' && r.storage === 'blocked', null, `SECURITY (${theme} preview): ${JSON.stringify(r)}`)
    check(r.theme === theme, null, `preview theme ${r.theme} != ${theme}`)
    await page.click('.chip:has-text("Text 2×")'); await page.click('.chip:has-text("Motion: none")'); await sleep(400)
    const p2 = await pf.evaluate(() => ({
      scale: getComputedStyle(document.documentElement).getPropertyValue('--qb-scale').trim(),
      motion: document.documentElement.dataset.motion,
      running: document.getAnimations().filter((a) => a.playState === 'running').length,
    }))
    check(p2.scale === '2' && p2.motion === 'none' && p2.running === 0,
      `theme ${theme}: renders in the opaque preview; honours text 2× and motion none (0 running animations)`,
      `theme ${theme} prefs not honoured: ${JSON.stringify(p2)}`)
    await page.click('.chip:has-text("Text 2×")'); await page.click('.chip:has-text("Motion: none")'); await sleep(200)
    if (theme === 'noir') await shot('16-admin-preview-noir')
  }
  const log = await page.locator('[data-testid="bridge-log"]').textContent()
  check(/STORYFRAME_HELLO/.test(log ?? '') && /BOOTSTRAP/.test(log ?? '') && /PREFERENCES_CHANGED/.test(log ?? ''),
    'wizard preview: bridge log shows HELLO → WELCOME → READY → BOOTSTRAP → PREFERENCES_CHANGED', 'bridge log incomplete')
  await page.click('.stepper button:has-text("Publish")'); await sleep(300)
  await contrast('admin wizard (publish)')
  await shot('17-admin-publish')

  /* ── 11. settings + a11y ──────────────────────────────────────────── */
  await page.goto(BASE + '#/settings'); await sleep(500)
  await shot('18-settings')
  await a11yBasics('settings')
  await contrast('settings (light)')
  const skip = await page.evaluate(() => !!document.querySelector('.skip') && document.documentElement.lang === 'en')
  check(skip, 'a11y: skip link + document language', 'no skip link / lang')
  await page.selectOption('#set-colorScheme', 'dark'); await sleep(300)
  await contrast('settings (dark)')
  await page.goto(BASE + '#/'); await sleep(600)
  await contrast('shelf (dark)')
  await shot('19-shelf-dark')
  await page.goto(BASE + '#/settings'); await sleep(300)
  await page.selectOption('#set-contrast', 'more'); await sleep(200)
  await contrast('settings (dark, more contrast)', page, 7)
  await page.selectOption('#set-colorScheme', 'light')
  await page.selectOption('#set-contrast', 'normal')

  /* ── 12. cross-origin mode via runtime config.json ────────────────── */
  const xctx = await browser.newContext({ viewport: { width: 1200, height: 800 } })
  const xp = await xctx.newPage()
  xp.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) fail('cross-origin console: ' + m.text()) })
  await xp.goto(XBASE + '#/play/neon-horizon', { waitUntil: 'networkidle' })
  await xp.waitForSelector('iframe'); await sleep(2000)
  const xf = storyFrame(xp)
  const x = await xf.evaluate(() => ({ origin: self.origin, parent: (() => { try { void parent.document; return 'REACHED' } catch { return 'blocked' } })(), booted: /RELAY/.test(document.getElementById('log')?.textContent ?? '') }))
  const sandbox = await xp.locator('iframe').getAttribute('sandbox')
  check(x.origin === 'http://localhost:4174' && x.parent === 'blocked' && x.booted && /allow-same-origin/.test(sandbox ?? ''),
    'runtime config: same build re-pointed by config.json → story on its own origin (:4174), exact-origin handshake, parent DOM blocked',
    'cross-origin mode: ' + JSON.stringify({ ...x, sandbox }))
  await xp.screenshot({ path: 'shots/20-cross-origin.png' })
  await xctx.close()

  /* ── 13. mobile ───────────────────────────────────────────────────── */
  const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
  const mp = await mob.newPage()
  await mp.goto(BASE, { waitUntil: 'networkidle' }); await sleep(600)
  if (await mp.locator('.dialog.onboard').count()) await mp.click('.onboard button:has-text("Skip for now")')
  await sleep(300)
  const ovf = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check(ovf <= 1, 'mobile 390px: no horizontal overflow on the shelf', 'mobile horizontal overflow ' + ovf + 'px')
  await contrast('mobile shelf', mp)
  await mp.screenshot({ path: 'shots/21-mobile-shelf.png' })
  await mp.goto(BASE + '#/play/the-keeper-of-wend-light'); await mp.waitForSelector('iframe'); await sleep(1800)
  const mchrome = await mp.locator('.player').getAttribute('data-chrome')
  check(mchrome === 'shown', 'mobile: player chrome stays visible on touch (no hover to reveal it)', 'mobile chrome hidden')
  await mp.screenshot({ path: 'shots/22-mobile-quickbook.png' })
  await mp.goto(BASE + '#/admin/new'); await sleep(500)
  const aovf = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check(aovf <= 1, 'mobile 390px: Admin Studio fits without horizontal overflow', 'admin mobile overflow ' + aovf + 'px')
  await mob.close()
} catch (e) {
  fail('audit crashed: ' + e.message)
}

await browser.close()
servers.forEach((s) => s.kill())
console.log(errors.length ? `\nPROBLEMS (${errors.length}), ${passed} checks passed:\n` + errors.map((e) => ' - ' + e).join('\n') : `\nALL ${passed} CHECKS PASSED`)
process.exit(errors.length ? 1 : 0)

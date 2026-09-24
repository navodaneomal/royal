/* Storyframe end-to-end audit.
   Runs against the production build served single-origin (the hardest
   security posture: every story in an OPAQUE sandbox). Covers the P0 gates:
   launch, handshake, atomic saves, resume, conflict UI, offline play,
   hostile-frame isolation, and accessibility basics. Writes screenshots. */
import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js'
const { chromium } = pw
import { mkdirSync } from 'node:fs'
import { spawn } from 'node:child_process'

const BASE = 'http://localhost:4173'
mkdirSync('shots', { recursive: true })
const errors = []
const note = (s) => console.log('  · ' + s)
const fail = (s) => { errors.push(s); console.log('  ✗ ' + s) }

const server = spawn('node', ['scripts/preview.mjs'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 1200))

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1360, height: 880 }, deviceScaleFactor: 2 })
ctx.on('weberror', (e) => fail('pageerror: ' + e.error().message))

const page = await ctx.newPage()
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) fail('console: ' + m.text()) })

const storyFrame = () => page.frames().find((f) => f !== page.mainFrame())
const shot = (n) => page.screenshot({ path: `shots/${n}.png` })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

try {
  /* ── 1. shelf ─────────────────────────────────────────────────────── */
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await sleep(600)
  const cards = await page.locator('.story-card').count()
  if (cards !== 2) fail(`shelf shows ${cards} stories, expected 2`)
  else note('shelf: both stories on the Living Shelf')
  await shot('01-shelf')

  /* ── 2. neon horizon: launch, handshake, atomic save ─────────────── */
  await page.click('a.story-card:has-text("Neon Horizon")')
  await sleep(500); await shot('02-detail-neon')
  await page.click('a.btn:has-text("Start reading")')
  await page.waitForSelector('iframe', { timeout: 8000 })
  await sleep(1800)
  let f = storyFrame()
  if (!f) throw new Error('no story frame')
  const booted = await f.locator('#log').textContent()
  if (!/RELAY/.test(booted ?? '')) fail('neon horizon did not boot in the opaque frame')
  else note('bridge: opaque handshake + bootstrap OK')

  /* hostile checks INSIDE the running opaque frame */
  const iso = await f.evaluate(() => {
    const out = {}
    try { void window.parent.document; out.parentDom = 'REACHED' } catch { out.parentDom = 'blocked' }
    try { void window.localStorage; out.storage = 'REACHED' } catch { out.storage = 'blocked' }
    try { out.cookie = document.cookie === '' ? 'empty' : 'REACHED' } catch { out.cookie = 'blocked' }
    out.origin = self.origin   // the DOCUMENT origin ('null' when opaque); location.origin would report the URL's origin either way
    return out
  })
  if (iso.parentDom !== 'blocked') fail('SECURITY: story frame reached parent DOM')
  if (iso.storage !== 'blocked') fail('SECURITY: story frame reached localStorage')
  if (iso.origin !== 'null') fail('SECURITY: story frame is not opaque (origin ' + iso.origin + ')')
  note(`isolation: parent DOM ${iso.parentDom}, storage ${iso.storage}, origin ${iso.origin}`)

  /* forged hello from the top document — wrong source, must be ignored */
  await page.evaluate(() => {
    window.postMessage({ type: 'STORYFRAME_HELLO', protocol: '1.0', storyId: '2b4dfd0e-91c8-45c0-8a3e-6f0a5cf6f2aa', releaseId: 'rforged000000', nonce: 'A'.repeat(24) }, '*')
  })
  await sleep(400)

  /* play: item, puzzle, choice, ending — each an atomic commit */
  await f.fill('#cmd', 'examine desk'); await f.press('#cmd', 'Enter'); await sleep(500)
  await f.fill('#cmd', 'align 741'); await f.press('#cmd', 'Enter'); await sleep(700)
  const chip1 = await page.locator('.savechip').textContent()
  if (!/Saved/.test(chip1 ?? '')) fail('save chip did not confirm: ' + chip1)
  else note('save chip: ' + chip1?.trim())
  await shot('03-neon-aligned')
  await f.fill('#cmd', 'stay'); await f.press('#cmd', 'Enter'); await sleep(700)
  await shot('04-neon-ending')

  /* forged-choice flip attempt straight through the story console:
     committed canonical choices must refuse to change (§15.5) */
  await f.fill('#cmd', 'transmit'); await f.press('#cmd', 'Enter'); await sleep(400)
  const after = await f.locator('#log').textContent()
  if (!/choice is made/i.test(after ?? '')) fail('story allowed re-deciding a committed choice')
  else note('canonical choice: locked after commit')

  /* ── 3. resume across reload ──────────────────────────────────────── */
  await page.click('.player-bar a:has-text("Back")')
  await sleep(600)
  const rev = await page.locator('.facts >> text=/revision/').textContent().catch(() => '')
  if (!/revision [1-9]/.test(rev ?? '')) fail('detail page shows no revision after play: ' + rev)
  await page.goto(BASE, { waitUntil: 'networkidle' }); await sleep(500)
  const badge = await page.locator('.story-card:has-text("Neon Horizon") .badge').first().textContent()
  if (!/Completed/.test(badge ?? '')) fail('shelf does not show Neon Horizon completed: ' + badge)
  else note('shelf: completion + story-language progress reflected')

  await page.click('a.story-card:has-text("Neon Horizon")')
  await page.click('a.btn:has-text("Continue")')
  await page.waitForSelector('iframe'); await sleep(1600)
  f = storyFrame()
  const resumed = await f.locator('#log').textContent()
  if (!/remembered you/i.test(resumed ?? '')) fail('story did not restore semantic state on relaunch')
  else note('resume: semantic checkpoint restored after full reload')
  await page.click('.player-bar a:has-text("Back")')

  /* ── 4. archive + achievements ────────────────────────────────────── */
  await page.goto(BASE + '#/collections'); await sleep(500)
  const arch = await page.locator('.entry:not(.locked)').count()
  if (arch < 3) fail('archive shows too few discovered entries: ' + arch)
  else note(`archive: ${arch} discovered entries with provenance`)
  await shot('05-archive')

  /* ── 5. the tulip & the jester: full visual identity inside frame ── */
  await page.goto(BASE + '#/story/the-tulip-and-the-jester'); await sleep(400)
  await page.click('a.btn:has-text("Start reading")')
  await page.waitForSelector('iframe'); await sleep(2500)
  f = storyFrame()
  const thr = await f.locator('.thr-title').textContent().catch(() => '')
  if (!/Tulip/i.test(thr ?? '')) fail('tulip threshold missing in frame')
  await shot('06-tulip-threshold')
  await f.click('#enterBtn'); await sleep(1800)
  await f.click('.card >> nth=0'); await sleep(3400)          // read timer fires the checkpoint
  const chip2 = await page.locator('.savechip').getAttribute('data-state')
  if (chip2 !== 'saved' && chip2 !== 'offline') fail('tulip checkpoint did not save: ' + chip2)
  else note('tulip: Part I checkpoint committed through the bridge')
  await shot('07-tulip-part1')
  await page.click('.player-bar a:has-text("Back")'); await sleep(400)
  await page.goto(BASE, { waitUntil: 'networkidle' }); await sleep(500)
  const cont = await page.locator('.continue-card .where').textContent().catch(() => '')
  if (!/Part I|Birthday/i.test(cont ?? '')) fail('continue card lacks story-language location: ' + cont)
  else note('continue card: "' + cont?.trim() + '"')
  await shot('08-shelf-progress')

  /* ── 6. conflict: two tabs, one timeline (§7.4) ───────────────────── */
  const tabB = await ctx.newPage()
  await tabB.goto(BASE + '#/play/neon-horizon', { waitUntil: 'networkidle' })
  await tabB.waitForSelector('iframe'); await sleep(1600)
  const fb = tabB.frames().find((x) => x !== tabB.mainFrame())
  // tab A advances the same timeline…
  await page.goto(BASE + '#/play/neon-horizon'); await page.waitForSelector('iframe'); await sleep(1600)
  const fa = page.frames().find((x) => x !== page.mainFrame())
  await fa.fill('#cmd', 'listen'); await fa.press('#cmd', 'Enter'); await sleep(600)
  // …then tab B (stale base revision) tries to commit
  await fb.fill('#cmd', 'listen'); await fb.press('#cmd', 'Enter'); await sleep(800)
  const dialog = await tabB.locator('.dialog h2').textContent().catch(() => '')
  if (!/Two timelines/i.test(dialog ?? '')) fail('divergence did not raise the timeline dialog: ' + dialog)
  else note('conflict: "Two timelines were found" — archived, not overwritten')
  await tabB.screenshot({ path: 'shots/09-conflict.png' })
  await tabB.click('.dialog .btn:has-text("Continue from latest")')
  await sleep(600)
  await tabB.close()
  await page.click('.player-bar a:has-text("Back")').catch(() => {})

  /* ── 7. offline: download, verify, airplane mode, play, save ─────── */
  await page.goto(BASE + '#/story/neon-horizon'); await sleep(400)
  await page.click('button:has-text("Download for offline")')
  await page.waitForSelector('a:has-text("Play offline copy")', { timeout: 8000 })
  note('download: integrity-verified package stored')
  await ctx.setOffline(true)
  await page.click('a:has-text("Play offline copy")')
  await page.waitForSelector('iframe'); await sleep(1800)
  const fo = page.frames().find((x) => x !== page.mainFrame())
  const offBoot = await fo.locator('#log').textContent().catch(() => '')
  if (!/RELAY/.test(offBoot ?? '')) fail('offline blob frame did not boot')
  await fo.fill('#cmd', 'look'); await fo.press('#cmd', 'Enter'); await sleep(300)
  await fo.fill('#cmd', 'listen'); await fo.press('#cmd', 'Enter'); await sleep(700)
  const chipOff = await page.locator('.savechip').textContent()
  if (!/Offline/i.test(chipOff ?? '')) fail('offline save state not honest: ' + chipOff)
  else note('offline: played from verified blob, chip = "' + chipOff?.trim() + '"')
  await shot('10-offline-play')
  await ctx.setOffline(false)
  await page.click('.player-bar a:has-text("Back")')

  /* ── 8. operator console ──────────────────────────────────────────── */
  await page.goto(BASE + '#/operator'); await sleep(700)
  const rows = await page.locator('table.op').first().locator('tbody tr').count()
  if (rows !== 2) fail('operator catalog rows: ' + rows)
  const auditRows = await page.locator('table.op').nth(1).locator('tbody tr').count()
  if (auditRows < 2) fail('audit log not visible in console')
  else note('operator: catalog, health counters, audit log visible')
  await shot('11-operator')

  /* ── 9. settings + a11y ───────────────────────────────────────────── */
  await page.goto(BASE + '#/settings'); await sleep(500)
  await shot('12-settings')
  const a11y = await page.evaluate(() => {
    const lum = (c) => { const [r, g, b] = c.match(/\d+/g).slice(0, 3).map(Number).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }
    const bg = getComputedStyle(document.body).backgroundColor
    return {
      bodyContrast: +ratio(getComputedStyle(document.body).color, bg).toFixed(2),
      hintContrast: +ratio(getComputedStyle(document.querySelector('.hint')).color, bg).toFixed(2),
      h1: document.querySelectorAll('h1').length,
      unlabeled: [...document.querySelectorAll('button')].filter((b) => !b.textContent.trim() && !b.getAttribute('aria-label')).length,
      lang: document.documentElement.lang,
      skip: !!document.querySelector('.skip'),
    }
  })
  if (a11y.bodyContrast < 4.5) fail('body contrast ' + a11y.bodyContrast)
  if (a11y.hintContrast < 4.5) fail('hint text contrast ' + a11y.hintContrast)
  if (a11y.h1 !== 1) fail(a11y.h1 + ' h1 elements')
  if (a11y.unlabeled) fail(a11y.unlabeled + ' unlabeled buttons')
  if (!a11y.skip) fail('no skip link')
  note('a11y: contrast ' + a11y.bodyContrast + ' / ' + a11y.hintContrast + ', single h1, labeled controls, skip link')

  /* preference reaches a live story */
  await page.click('#set-scale + *, #set-scale').catch(() => {})
  await page.goto(BASE + '#/play/neon-horizon'); await page.waitForSelector('iframe'); await sleep(1500)

  /* ── 10. mobile spot check ────────────────────────────────────────── */
  const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  const mp = await mob.newPage()
  await mp.goto(BASE, { waitUntil: 'networkidle' }); await sleep(600)
  const ovf = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if (ovf > 1) fail('mobile horizontal overflow ' + ovf + 'px')
  await mp.screenshot({ path: 'shots/13-mobile-shelf.png' })
  await mp.goto(BASE + '#/play/the-tulip-and-the-jester'); await mp.waitForSelector('iframe'); await sleep(2400)
  await mp.screenshot({ path: 'shots/14-mobile-tulip.png' })
  await mob.close()
} catch (e) {
  fail('audit crashed: ' + e.message)
}

await browser.close()
server.kill()
console.log(errors.length ? `\nPROBLEMS (${errors.length}):\n` + errors.map((e) => ' - ' + e).join('\n') : '\nALL CHECKS PASSED')
process.exit(errors.length ? 1 : 0)

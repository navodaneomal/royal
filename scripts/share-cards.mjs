#!/usr/bin/env node
/* Share cards (P2): for every story in a content-plane directory, write
     share/<slug>.html   Open Graph + Twitter meta, then a redirect to #/story/<slug>
     share/<slug>.svg    1200×630 card (always)
     share/<slug>.png    the same card rasterised — only when Playwright + a browser
                         are available (most social sites ignore SVG og:image)
   Hash routes are invisible to crawlers, so the share page is the URL people
   paste; the reader lands on the story's detail page in the app. */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { escapeHtml, contrastRatio, bestInk } from '../packages/publishing/src/index.js'

const wrap = (text, max) => {
  const out = []
  let cur = ''
  for (const w of String(text).split(/\s+/)) {
    if (!cur) cur = w
    else if ((cur + ' ' + w).length <= max) cur += ' ' + w
    else { out.push(cur); cur = w }
  }
  if (cur) out.push(cur)
  return out
}

export function shareCardSvg(story, coverDataUri) {
  const accent = /^#[0-9a-f]{6}$/i.test(story.accent ?? '') ? story.accent : '#b98b43'
  const bg = '#191612'
  const ink = contrastRatio('#f5f1e8', bg) >= 7 ? '#f5f1e8' : bestInk(bg)
  const title = wrap(story.title, 22).slice(0, 3)
  const tag = wrap(story.tagline ?? '', 44).slice(0, 2)
  const tspans = title.map((l, i) => `<tspan x="560" y="${250 + i * 70}">${escapeHtml(l)}</tspan>`).join('')
  const tagSpans = tag.map((l, i) => `<tspan x="560" y="${260 + title.length * 70 + i * 36}">${escapeHtml(l)}</tspan>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">`
    + `<defs><radialGradient id="g" cx="0.2" cy="0.3" r="0.9"><stop offset="0" stop-color="${accent}" stop-opacity=".45"/><stop offset="1" stop-color="${bg}" stop-opacity="0"/></radialGradient></defs>`
    + `<rect width="1200" height="630" fill="${bg}"/><rect width="1200" height="630" fill="url(#g)"/>`
    + (coverDataUri ? `<image href="${coverDataUri}" x="90" y="75" width="360" height="480" preserveAspectRatio="xMidYMid slice"/>` : '')
    + `<rect x="90" y="75" width="360" height="480" fill="none" stroke="${ink}" stroke-opacity=".25"/>`
    + `<text font-family="Georgia, 'Iowan Old Style', serif" font-size="60" fill="${ink}">${tspans}</text>`
    + `<text font-family="Georgia, serif" font-style="italic" font-size="28" fill="${ink}" fill-opacity=".85">${tagSpans}</text>`
    + `<rect x="560" y="500" width="64" height="4" fill="${accent}"/>`
    + `<text x="560" y="548" font-family="system-ui, 'Segoe UI', sans-serif" font-size="24" letter-spacing="4" fill="${ink}" fill-opacity=".8">READ ON STORYFRAME</text>`
    + `</svg>`
}

function sharePage(story, { appUrl, imageUrl }) {
  const target = `${appUrl.replace(/\/?$/, '/')}#/story/${encodeURIComponent(story.slug)}`
  const desc = story.tagline || story.synopsis || 'An interactive story on Storyframe.'
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(story.title)} — Storyframe</title>
<meta name="description" content="${escapeHtml(desc)}">
<meta property="og:type" content="book">
<meta property="og:title" content="${escapeHtml(story.title)}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:image" content="${escapeHtml(imageUrl)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url=${escapeHtml(target)}">
<link rel="canonical" href="${escapeHtml(target)}">
<style>body{font:18px/1.6 Georgia,serif;background:#191612;color:#f5f1e8;display:grid;place-content:center;min-height:100vh;margin:0;text-align:center}a{color:#e0b86a}</style>
</head>
<body><p>Opening <a href="${escapeHtml(target)}">${escapeHtml(story.title)}</a> on Storyframe…</p></body>
</html>
`
}

async function rasterise(cards) {
  let chromium
  try { ({ chromium } = await import('playwright')) } catch { return 0 }
  let browser
  for (const opts of [{}, { channel: 'chrome' }]) {
    try { browser = await chromium.launch(opts); break } catch { /* try the next */ }
  }
  if (!browser) return 0
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
  for (const { svg, png } of cards) {
    await page.setContent(`<style>body{margin:0}</style>${svg}`)
    await page.screenshot({ path: png, clip: { x: 0, y: 0, width: 1200, height: 630 } })
  }
  await browser.close()
  return cards.length
}

/**
 * @param {string} dir content-plane directory (with registry.json)
 * @param {{ appUrl:string, storiesUrl?:string, png?:boolean }} o
 */
export async function writeShareCards(dir, { appUrl, storiesUrl = '', png = true }) {
  const regPath = join(dir, 'registry.json')
  if (!existsSync(regPath)) return { written: 0, png: 0 }
  const reg = JSON.parse(readFileSync(regPath, 'utf8'))
  mkdirSync(join(dir, 'share'), { recursive: true })
  const cards = []
  for (const story of reg.stories) {
    const coverPath = story.cover && join(dir, story.cover)
    let cover = null
    if (coverPath && existsSync(coverPath)) {
      const ext = coverPath.split('.').pop().toLowerCase()
      const mime = { svg: 'image/svg+xml', png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg' }[ext]
      cover = `data:${mime};base64,${readFileSync(coverPath).toString('base64')}`
    }
    const svg = shareCardSvg(story, cover)
    writeFileSync(join(dir, 'share', `${story.slug}.svg`), svg)
    cards.push({ story, svg, png: join(dir, 'share', `${story.slug}.png`) })
  }
  const rendered = png ? await rasterise(cards) : 0
  for (const { story } of cards) {
    const file = `${story.slug}.${rendered ? 'png' : 'svg'}`
    const imageUrl = storiesUrl ? `${storiesUrl.replace(/\/$/, '')}/share/${file}` : file
    writeFileSync(join(dir, 'share', `${story.slug}.html`), sharePage(story, { appUrl, imageUrl }))
  }
  return { written: cards.length, png: rendered }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [dir = 'infra/story-host/stories-host', appUrl = '../../'] = process.argv.slice(2)
  const r = await writeShareCards(resolve(dir), { appUrl })
  console.log(`share cards: ${r.written} written, ${r.png} rasterised to PNG`)
}

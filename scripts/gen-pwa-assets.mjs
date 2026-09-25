#!/usr/bin/env node
/* Renders the PWA's PNG icons from the SVG sources, and (when the audit has
   produced screenshots in shots/) the manifest screenshots. Run after
   `npm run verify`; outputs are committed static assets in apps/web/public. */
import { chromium } from 'playwright'
import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const PUB = resolve('apps/web/public')
const svg = (f) => readFileSync(resolve(PUB, f), 'utf8')
const browser = await chromium.launch()
const page = await browser.newPage()

async function icon(source, size, out) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${source}`)
  await page.screenshot({ path: resolve(PUB, out), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } })
  console.log('  ✓ ' + out)
}
await icon(svg('icon.svg'), 192, 'icon-192.png')
await icon(svg('icon.svg'), 512, 'icon-512.png')
await icon(svg('icon-maskable.svg'), 512, 'icon-maskable-512.png')
await icon(svg('icon-maskable.svg'), 180, 'apple-touch-icon.png')

async function resize(src, out, width, height) {
  if (!existsSync(src)) return console.log('  · skipped ' + out + ' (run npm run verify first)')
  mkdirSync(resolve(PUB, 'screenshots'), { recursive: true })
  const b64 = readFileSync(src).toString('base64')
  await page.setViewportSize({ width, height })
  await page.setContent(`<style>html,body{margin:0}img{display:block;width:${width}px;height:${height}px;object-fit:cover;object-position:top}</style><img src="data:image/png;base64,${b64}">`)
  await page.waitForLoadState('load')
  await page.screenshot({ path: resolve(PUB, 'screenshots', out), clip: { x: 0, y: 0, width, height } })
  console.log('  ✓ screenshots/' + out)
}
await resize('shots/09-shelf-progress.png', 'wide-shelf.png', 1360, 880)
await resize('shots/21-mobile-shelf.png', 'narrow-shelf.png', 390, 844)
await resize('shots/22-mobile-quickbook.png', 'narrow-reading.png', 390, 844)
await browser.close()

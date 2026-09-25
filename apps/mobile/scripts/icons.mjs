#!/usr/bin/env node
/* Launcher icons for the Android project, rendered from the web app's SVGs
   (legacy square + round icons, and adaptive-icon foregrounds). */
import { chromium } from 'playwright'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const RES = resolve(here, '../android/app/src/main/res')
const PUB = resolve(here, '../../web/public')
const icon = readFileSync(join(PUB, 'icon.svg'), 'utf8')
const glyph = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><g transform="translate(24 24) scale(0.5)">${icon.replace(/<\/?svg[^>]*>/g, '').replace(/<rect width="96" height="96"[^>]*\/>/, '')}</g></svg>`
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
const browser = await chromium.launch()
const page = await browser.newPage()
async function render(svg, size, file, round = false) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px;${round ? 'border-radius:50%;' : ''}}</style>${svg}`)
  mkdirSync(dirname(file), { recursive: true })
  await page.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } })
}
for (const [d, k] of Object.entries(DENSITIES)) {
  await render(icon, Math.round(48 * k), join(RES, `mipmap-${d}`, 'ic_launcher.png'))
  await render(icon, Math.round(48 * k), join(RES, `mipmap-${d}`, 'ic_launcher_round.png'), true)
  await render(glyph, Math.round(108 * k), join(RES, `mipmap-${d}`, 'ic_launcher_foreground.png'))
}
writeFileSync(join(RES, 'values', 'ic_launcher_background.xml'), '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#221E19</color>\n</resources>\n')
await browser.close()
console.log('  ✓ launcher icons written to android/app/src/main/res')

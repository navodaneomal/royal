/**
 * HTML/CSS inlining for the declarative builder. Regex-based on purpose:
 * story HTML is authored by humans for one book, the transformations are
 * narrow (resolve a relative reference, swap it for bytes), and a DOM parser
 * would behave differently in Node and the browser. Every rewrite is
 * deterministic so the package hash is identical wherever it is built.
 */
import { toText, extOf, MIME, resolveRef, toBase64, isForeignRef } from './files.js'

const FONT_CDN_RE = /(fonts\.googleapis\.com|fonts\.gstatic\.com|use\.typekit\.net|fonts\.bunny\.net|fast\.fonts\.net|use\.fontawesome\.com)/i

/** Minify-lite an SVG and turn it into a compact, attribute-safe data URI. */
export function svgDataUri(svgText) {
  const compact = svgText
    .replace(/<\?xml[^>]*\?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
  return 'data:image/svg+xml,' + compact.replace(/["%#<>{}|\\^`'()\s]/g, (c) =>
    c === ' ' ? '%20' : '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'))
}

export function dataUri(path, bytes) {
  const ext = extOf(path)
  if (ext === 'svg') return svgDataUri(toText(bytes))
  return `data:${MIME[ext] ?? 'application/octet-stream'};base64,${toBase64(bytes)}`
}

/**
 * Create an inliner bound to one source file map.
 * @param {Map<string, Uint8Array>} files
 * @param {{ errors:string[], warnings:string[], notes:string[] }} log
 * @param {{ scripts?:boolean, styles?:boolean, images?:boolean, fonts?:boolean, media?:boolean }} opts
 */
export function createInliner(files, log, opts = {}) {
  const o = { scripts: true, styles: true, images: true, fonts: true, media: true, ...opts }
  const used = new Set()
  const kindOf = (path) => {
    const ext = extOf(path)
    if (['woff2', 'woff', 'ttf', 'otf'].includes(ext)) return 'fonts'
    if (['mp3', 'ogg', 'wav', 'm4a', 'mp4', 'webm', 'vtt'].includes(ext)) return 'media'
    return 'images'
  }

  function asset(fromFile, ref, context) {
    if (/[${}+<>]|^\s*$/.test(ref)) return null        // a JS template or expression, not a path
    if (/^(#|%23)/.test(ref)) return null                // in-document fragment (e.g. an SVG filter id)
    if (isForeignRef(ref.trim())) return null         // data:, blob:, absolute — not ours to touch
    const path = resolveRef(fromFile, ref)
    if (path === null) { log.errors.push(`${ref} (from ${fromFile}) points outside the story folder`); return null }
    const bytes = files.get(path)
    if (!bytes) { log.errors.push(`missing asset ${ref} (referenced from ${fromFile}${context ? ', ' + context : ''})`); return null }
    if (!o[kindOf(path)]) return null
    used.add(path)
    if (bytes.byteLength > 300 * 1024 && ['png', 'jpg', 'jpeg'].includes(extOf(path)))
      log.warnings.push(`${path} is ${Math.round(bytes.byteLength / 1024)} KB — consider webp before inlining`)
    return dataUri(path, bytes)
  }

  /** rewrite url(...) references in CSS text that lives at `cssFile` */
  function css(text, cssFile) {
    let out = text.replace(/@import\s+(?:url\()?\s*["']([^"']+)["']\s*\)?\s*;/g, (all, ref) => {
      if (FONT_CDN_RE.test(ref)) { log.notes.push(`stripped external font import ${ref}`); return '' }
      const path = resolveRef(cssFile, ref)
      if (!path || !files.has(path)) return all
      used.add(path)
      return css(toText(files.get(path)), path)
    })
    out = out.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/g, (all, _q, ref) => {
      const uri = asset(cssFile, ref.trim(), 'css url()')
      return uri ? `url("${uri.replace(/"/g, '%22')}")` : all
    })
    return out
  }

  /** inline everything a single HTML document references */
  function html(text, htmlFile, { stripExternalFonts = true } = {}) {
    let out = text

    if (stripExternalFonts) {
      out = out.replace(/<link\b[^>]*\brel\s*=\s*["'](?:preconnect|dns-prefetch)["'][^>]*>\s*/gi, (tag) => {
        log.notes.push('stripped resource hint ' + (tag.match(/href\s*=\s*["']([^"']+)/i)?.[1] ?? ''))
        return ''
      })
      out = out.replace(/<link\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>\s*/gi, (tag, href) => {
        if (!FONT_CDN_RE.test(href)) return tag
        log.notes.push('stripped external font stylesheet ' + href)
        return ''
      })
    }

    if (o.styles) {
      out = out.replace(/<link\b([^>]*\brel\s*=\s*["']stylesheet["'][^>]*)>/gi, (tag, attrs) => {
        const href = attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1]
        if (!href) return tag
        if (isForeignRef(href)) return tag
        const path = resolveRef(htmlFile, href)
        if (path === null) { log.errors.push(`stylesheet ${href} points outside the story folder`); return tag }
        if (!files.has(path)) { log.errors.push(`missing stylesheet ${href} (from ${htmlFile})`); return tag }
        used.add(path)
        const media = attrs.match(/\bmedia\s*=\s*["']([^"']+)["']/i)?.[1]
        return `<style${media ? ` media="${media}"` : ''}>\n${css(toText(files.get(path)), path)}\n</style>`
      })
    }
    out = out.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (_, open, body, close) => open + css(body, htmlFile) + close)
    out = out.replace(/\bstyle\s*=\s*"([^"]*url\([^"]*)"/gi, (_, body) => `style="${css(body.replace(/&quot;/g, '"'), htmlFile).replace(/"/g, '&quot;')}"`)

    if (o.scripts) {
      out = out.replace(/<script\b([^>]*)\bsrc\s*=\s*["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (tag, before, src, after) => {
        if (/(^|\/)storyframe-sdk(\.iife)?\.js$/.test(src)) return tag   // SDK slot — handled by the builder
        if (isForeignRef(src)) return tag
        const path = resolveRef(htmlFile, src)
        if (path === null) { log.errors.push(`missing script ${src}: it points outside the story folder`); return tag }
        if (!files.has(path)) { log.errors.push(`missing script ${src} (from ${htmlFile})`); return tag }
        used.add(path)
        const attrs = (before + after).replace(/\s+(defer|async)(?:\s*=\s*["'][^"']*["'])?/gi, (m, name) => {
          log.warnings.push(`${name} ignored on inlined ${src} — place the script at the end of <body>`)
          return ''
        }).trim()
        const body = toText(files.get(path)).replace(/<\/script/gi, '<\\/script')
        return `<script${attrs ? ' ' + attrs : ''}>\n${body}\n</script>`
      })
    }

    // src / poster / href on media + images (not <a href>, not <link>)
    out = out.replace(/<(img|source|audio|video|track|image|input)\b([^>]*)>/gi, (tag, name, attrs) => {
      let a = attrs.replace(/\b(src|poster|href|xlink:href)\s*=\s*(["'])([^"']+)\2/gi, (m, attr, _q, ref) => {
        const uri = asset(htmlFile, ref, `<${name} ${attr}>`)
        return uri ? `${attr}="${uri.replace(/"/g, '%22')}"` : m
      })
      a = a.replace(/\bsrcset\s*=\s*(["'])([^"']+)\1/gi, (m, _q, set) => {
        const parts = set.split(',').map((s) => s.trim()).filter(Boolean).map((cand) => {
          const [ref, ...desc] = cand.split(/\s+/)
          const uri = asset(htmlFile, ref, `<${name} srcset>`)
          return [uri ?? ref, ...desc].join(' ')
        })
        return `srcset="${parts.join(', ').replace(/"/g, '%22')}"`
      })
      return `<${name}${a}>`
    })
    out = out.replace(/<link\b([^>]*\brel\s*=\s*["'](?:icon|apple-touch-icon)["'][^>]*)>/gi, (tag, attrs) => {
      const href = attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1]
      const uri = href && asset(htmlFile, href, 'icon')
      return uri ? `<link${attrs.replace(/\bhref\s*=\s*["'][^"']+["']/i, `href="${uri.replace(/"/g, '%22')}"`)}>` : tag
    })
    return out
  }

  return { html, css, asset, used }
}

/** Insert the story CSP meta right after <meta charset> (or <head>), replacing any existing CSP meta. */
export function stampCsp(html, cspMeta) {
  let out = html.replace(/<meta\b[^>]*http-equiv\s*=\s*["']Content-Security-Policy["'][^>]*>\s*/gi, '')
  if (/<meta\s+charset\s*=\s*["']?[\w-]+["']?\s*\/?>/i.test(out)) {
    return out.replace(/(<meta\s+charset\s*=\s*["']?[\w-]+["']?\s*\/?>)/i, `$1\n${cspMeta}`)
  }
  if (/<head\b[^>]*>/i.test(out)) return out.replace(/(<head\b[^>]*>)/i, `$1\n<meta charset="utf-8">\n${cspMeta}`)
  return null
}

/** Stamp data-sf-release on <html> unless the author already placed it. */
export function stampReleaseAttr(html) {
  if (/<html\b[^>]*data-sf-release\s*=/i.test(html)) return html
  return html.replace(/<html\b/i, '<html data-sf-release="__SF_RELEASE_ID__"')
}

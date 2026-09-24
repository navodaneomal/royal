/**
 * Quick Book themes — five genuinely different worlds, all plain CSS (plus a
 * few lines of JS where a theme wants a flourish), all offline (system font
 * stacks only), all honouring every reader preference:
 *
 *   html[data-motion=full|reduced|none]      ambient motion stops for reduced/none
 *   html[data-contrast=more]                 theme's own high-contrast palette
 *   html[data-font=story|readable|dyslexia-friendly]
 *   html[data-lh=compact|normal|relaxed]
 *   --qb-scale                               the reader's text scale (0.8–2)
 *   html[data-scheme=dark|light]             only "minimal" follows it; the others are art
 *
 * Tokens live in JS so tests can prove contrast numerically
 * (tests/publishing/themes.test.js).
 */
import { BASE_CSS } from './base.js'

export const THEMES = {
  manuscript: {
    label: 'Manuscript',
    description: 'Candlelit parchment, oxblood ink, a serif that remembers quills.',
    tokens: { bg: '#efe3c8', surface: '#f6ecd6', ink: '#2a2017', muted: '#5b4a36', accent: '#7a2e1d', accentInk: '#fbf3e2', line: '#c9b48c' },
    more: { ink: '#140e08', muted: '#2a2017', accent: '#5e1f12', line: '#8a7550' },
    fonts: { body: '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif', head: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif' },
    css: `
html[data-theme="manuscript"] body{background:radial-gradient(120% 90% at 50% 0%,var(--qb-surface),var(--qb-bg) 60%,#d9c7a2)}
html[data-theme="manuscript"] .qb-atmosphere i:first-child{position:fixed;inset:-20% -10% auto;height:70vh;background:radial-gradient(40% 50% at 50% 20%,rgba(255,190,110,.22),transparent 70%);animation:qb-candle 5.5s ease-in-out infinite alternate}
html[data-theme="manuscript"] .qb-atmosphere i:nth-child(2){position:fixed;inset:0;box-shadow:inset 0 0 12vmax rgba(60,35,10,.28)}
@keyframes qb-candle{0%{opacity:.75;transform:translateY(0) scale(1)}40%{opacity:1;transform:translateY(-4px) scale(1.02)}70%{opacity:.85}100%{opacity:.95;transform:translateY(2px) scale(.99)}}
html[data-theme="manuscript"] h1,html[data-theme="manuscript"] h2{font-weight:500;letter-spacing:.01em}
html[data-theme="manuscript"] .qb-kicker{font-variant:small-caps;letter-spacing:.12em}
html[data-theme="manuscript"][data-font="story"] .qb-prose>p:first-of-type::first-letter{float:left;font-size:3.4em;line-height:.9;padding:.06em .08em 0 0;color:var(--qb-accent)}
html[data-theme="manuscript"] .qb-break::after{content:"❦"}
`,
  },

  terminal: {
    label: 'Terminal',
    description: 'Amber phosphor on a dead screen, scanlines, a patient cursor.',
    tokens: { bg: '#0e0a04', surface: '#17110a', ink: '#ffb65c', muted: '#d49a4c', accent: '#ffd9a0', accentInk: '#0e0a04', line: '#5a3e18' },
    more: { ink: '#ffd9a8', muted: '#ffc27a', accent: '#fff0d6', line: '#a8783a' },
    fonts: { body: 'ui-monospace, "Cascadia Mono", "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", "Liberation Mono", monospace', head: 'ui-monospace, "Cascadia Mono", Menlo, Consolas, monospace' },
    css: `
html[data-theme="terminal"] body{text-shadow:0 0 .35em rgba(255,166,64,.28)}
html[data-contrast="more"][data-theme="terminal"] body{text-shadow:none}
html[data-theme="terminal"] .qb-atmosphere i:first-child{position:fixed;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(0,0,0,.22) 0 1px,transparent 1px 3px);z-index:3}
html[data-theme="terminal"] .qb-atmosphere i:nth-child(2){position:fixed;inset:0;pointer-events:none;background:radial-gradient(110% 90% at 50% 45%,transparent 60%,rgba(0,0,0,.55));z-index:3}
html[data-theme="terminal"] .qb-atmosphere i:nth-child(3){position:fixed;inset:0;pointer-events:none;background:rgba(255,170,60,.035);animation:qb-flicker 7s steps(2) infinite;z-index:3}
@keyframes qb-flicker{0%,93%{opacity:1}95%{opacity:.4}97%{opacity:1}}
html[data-theme="terminal"] h1::before,html[data-theme="terminal"] h2::before{content:"> ";color:var(--qb-muted)}
html[data-theme="terminal"] h2::after{content:"▌";margin-left:.2em;animation:qb-blink 1.1s steps(1) infinite}
@keyframes qb-blink{50%{opacity:0}}
html[data-theme="terminal"] .qb-btn{border-radius:0;text-transform:uppercase;letter-spacing:.08em}
html[data-theme="terminal"] .qb-break::after{content:"-- -- --"}
html[data-theme="terminal"] .qb-chapter:not([hidden]) .qb-prose{animation:qb-type .5s steps(12) both}
@keyframes qb-type{from{clip-path:inset(0 0 100% 0)}to{clip-path:inset(0 0 0 0)}}
`,
  },

  watercolor: {
    label: 'Watercolor',
    description: 'Soft washes that drift at the edges of a clean white page.',
    tokens: { bg: '#fbf8f3', surface: '#ffffff', ink: '#27323d', muted: '#4f5b67', accent: '#1f5f80', accentInk: '#ffffff', line: '#d7dde3' },
    more: { ink: '#0f171f', muted: '#27323d', accent: '#123f57', line: '#8a97a4' },
    fonts: { body: '"Avenir Next", Avenir, "Segoe UI", "Helvetica Neue", "Trebuchet MS", sans-serif', head: 'Georgia, "Iowan Old Style", "Times New Roman", serif' },
    css: `
html[data-theme="watercolor"] .qb-atmosphere i{position:fixed;border-radius:50%;filter:blur(40px);opacity:.38;pointer-events:none;z-index:0}
html[data-theme="watercolor"] .qb-atmosphere i:nth-child(1){width:46vmax;height:46vmax;left:-18vmax;top:-16vmax;background:#9cc3dd;animation:qb-drift1 24s ease-in-out infinite alternate}
html[data-theme="watercolor"] .qb-atmosphere i:nth-child(2){width:40vmax;height:40vmax;right:-16vmax;top:30vh;background:#efb7b0;animation:qb-drift2 30s ease-in-out infinite alternate}
html[data-theme="watercolor"] .qb-atmosphere i:nth-child(3){width:36vmax;height:36vmax;left:10vw;bottom:-22vmax;background:#e9d49a;animation:qb-drift1 36s ease-in-out infinite alternate-reverse}
@keyframes qb-drift1{to{transform:translate(6vmax,4vmax) scale(1.08)}}
@keyframes qb-drift2{to{transform:translate(-5vmax,-6vmax) scale(.94)}}
html[data-contrast="more"][data-theme="watercolor"] .qb-atmosphere{display:none}
html[data-theme="watercolor"] main{position:relative;z-index:1}
html[data-theme="watercolor"] h1,html[data-theme="watercolor"] h2{font-style:italic;font-weight:400}
html[data-theme="watercolor"] .qb-chapter,html[data-theme="watercolor"] .qb-cover{background:color-mix(in srgb,var(--qb-surface) 82%,transparent);border-radius:18px;padding:clamp(1.2rem,4vw,2.6rem);box-shadow:0 20px 60px -40px rgba(31,95,128,.45)}
html[data-theme="watercolor"] .qb-break::after{content:"～"}
`,
  },

  noir: {
    label: 'Noir',
    description: 'Hard black, white type, one red light, rain on the glass.',
    tokens: { bg: '#0b0b0c', surface: '#141416', ink: '#ececec', muted: '#b0b0b0', accent: '#ff5a4f', accentInk: '#0b0b0c', line: '#3a3a3e' },
    more: { ink: '#ffffff', muted: '#dcdcdc', accent: '#ff8a80', line: '#8a8a8e' },
    fonts: { body: '"Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif', head: 'Didot, "Bodoni 72", "Bodoni MT", "Playfair Display", "Times New Roman", serif' },
    css: `
html[data-theme="noir"] .qb-atmosphere i:first-child{position:fixed;inset:-50%;pointer-events:none;opacity:.07;z-index:3;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");animation:qb-grain .9s steps(4) infinite}
@keyframes qb-grain{0%{transform:translate(0,0)}25%{transform:translate(-3%,2%)}50%{transform:translate(2%,-3%)}75%{transform:translate(-2%,-1%)}100%{transform:translate(1%,3%)}}
html[data-theme="noir"] .qb-atmosphere i:nth-child(2){position:fixed;inset:0;pointer-events:none;z-index:2;background:repeating-linear-gradient(100deg,transparent 0 22px,rgba(255,255,255,.035) 22px 23px);animation:qb-rain 1.2s linear infinite}
@keyframes qb-rain{from{background-position:0 0}to{background-position:-40px 160px}}
html[data-theme="noir"] .qb-atmosphere i:nth-child(3){position:fixed;inset:0;pointer-events:none;z-index:2;background:radial-gradient(80% 60% at 50% 30%,transparent 40%,rgba(0,0,0,.7))}
html[data-contrast="more"][data-theme="noir"] .qb-atmosphere{display:none}
html[data-theme="noir"] h1,html[data-theme="noir"] h2{text-transform:uppercase;letter-spacing:.14em;font-weight:400}
html[data-theme="noir"] h1{font-size:clamp(2rem,6vw,3.6rem);line-height:1.05}
html[data-theme="noir"] .qb-kicker{color:var(--qb-accent);letter-spacing:.3em;text-transform:uppercase;font-size:.72em}
html[data-theme="noir"] blockquote{border-left-color:var(--qb-accent)}
html[data-theme="noir"] .qb-break::after{content:"■";color:var(--qb-accent);font-size:.6em}
`,
  },

  minimal: {
    label: 'Minimal',
    description: 'Clean modern reading. Follows the reader’s light or dark setting.',
    tokens: { bg: '#ffffff', surface: '#f6f6f4', ink: '#1a1a1a', muted: '#555555', accent: '#1d58b8', accentInk: '#ffffff', line: '#e2e2de' },
    dark: { bg: '#121213', surface: '#1b1b1d', ink: '#ececec', muted: '#a9a9a9', accent: '#8ab4ff', accentInk: '#0b1a33', line: '#2e2e32' },
    more: { ink: '#000000', muted: '#262626', accent: '#0c3f91', line: '#8c8c88' },
    moreDark: { ink: '#ffffff', muted: '#dddddd', accent: '#b8d1ff', line: '#6a6a70' },
    fonts: { body: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', head: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' },
    css: `
html[data-theme="minimal"] h1,html[data-theme="minimal"] h2{font-weight:650;letter-spacing:-.015em}
html[data-theme="minimal"] .qb-break::after{content:"· · ·"}
`,
  },
}

const vars = (t) => Object.entries(t).map(([k, v]) => `--qb-${k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}:${v}`).join(';')

/** Full CSS for one theme: base layout + tokens + contrast/scheme variants + flourishes. */
export function themeCss(name) {
  const t = THEMES[name] ?? THEMES.manuscript
  let css = BASE_CSS
  css += `\nhtml[data-theme="${name}"]{${vars(t.tokens)};--qb-font-body:${t.fonts.body};--qb-font-head:${t.fonts.head}}`
  if (t.dark) css += `\nhtml[data-theme="${name}"][data-scheme="dark"]{${vars(t.dark)}}`
  css += `\nhtml[data-theme="${name}"][data-contrast="more"]{${vars(t.more)}}`
  if (t.moreDark) css += `\nhtml[data-theme="${name}"][data-scheme="dark"][data-contrast="more"]{${vars(t.moreDark)}}`
  css += t.css
  return css
}

export const THEME_NAMES = Object.keys(THEMES)

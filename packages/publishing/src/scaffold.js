/**
 * Starter folders for `storyframe new <slug> --template quick|native|wrap`
 * and the Admin Studio's "download a starter" button. Pure: returns a file map.
 */
import { toBytes } from './files.js'
import { generateCover } from './cover.js'

export const TEMPLATES = ['quick', 'native', 'wrap']

const titleFromSlug = (slug) => slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')

export function baseManifest({ storyId, slug, title, template }) {
  const m = {
    $schema: 'https://storyframe.dev/schemas/storyframe.v1.json',
    storyId, slug, version: '0.1.0',
    protocolVersion: template === 'quick' ? '1.1' : '1.0',
    stateSchemaVersion: 1,
    title, tagline: 'One line that makes a reader lean in.',
    synopsis: '',
    cover: 'cover.svg',
    entrypoint: 'index.html',
    languages: ['en'], defaultLanguage: 'en',
    capabilities: ['progress.write', 'inventory.write', 'achievement.unlock', 'choice.commit'],
    content: { rating: 'everyone', warnings: [], estimatedMinutes: { firstSession: 10, total: [10, 20] } },
    accessibility: { keyboard: true, screenReader: true, reducedMotion: true, captions: true, untimedMode: true, nonAudioAlternative: true },
    offline: { eligible: true, required: ['index.html'], optional: [], maxBytes: 5242880 },
    checkpoints: [{ id: 'start', label: 'The beginning', order: 10 }],
    items: [], achievements: [], choices: [], endings: [],
    migrations: [],
  }
  if (template === 'quick') m.build = { quickbook: { source: 'book.md', theme: 'manuscript' } }
  if (template === 'native') m.build = { entry: 'src/index.html' }
  if (template === 'wrap') m.build = { concat: ['src/00-original.html', '@sdk', 'src/45-storyframe-glue.html', 'src/99-end.html'] }
  return m
}

const QUICK_BOOK = (title) => `---
theme: manuscript
rating: everyone
---
# ${title}

*An epigraph, if you like. It shows on the cover page.*

## The First Chapter {#first}

Write in plain Markdown. Every "##" heading is a chapter, and entering a
chapter saves the reader's place. Keep the {#id} on each heading forever —
it is how readers resume.

:::secret{id="first-secret" name="A folded note" alt="A small folded note with a pressed flower inside" hint="Something is tucked between the pages"}
Hidden text only curious readers find. It goes to their Archive.
:::

::achievement{id="first-steps" name="First Steps" description="Began the story."}

## The Second Chapter {#second}

:::choice{id="the-road" label="Which way?"}
- left: Take the lantern road
- right: Take the river path
:::

:::branch{choice="the-road" option="left"}
The lantern road. Only readers who chose it see this.

:::ending{id="lantern-ending" name="By Lantern Light"}
One way the story can end.
:::
:::

:::branch{choice="the-road" option="right"}
The river path.

:::ending{id="river-ending" name="Down the River"}
Another way the story can end.
:::
:::
`

const NATIVE_HTML = (title) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="./style.css">
</head>
<body>
<main id="story" tabindex="-1">
  <h1>${title}</h1>
  <p id="text">Loading…</p>
  <p><button type="button" id="next">Continue</button></p>
</main>
<!-- storyframe:sdk -->
<script src="./story.js"></script>
</body>
</html>
`

const NATIVE_JS = (storyId) => `/* A native Storyframe story — plain JS + the SDK. See docs/BOOK-AUTHORING.md. */
(function () {
  'use strict'
  var STORY_ID = '${storyId}'
  var RELEASE_ID = document.documentElement.getAttribute('data-sf-release') || 'dev'
  var text = document.getElementById('text')
  var next = document.getElementById('next')
  var session = null
  var state = { step: 0 }
  var PAGES = ['It begins.', 'It continues.', 'It ends — for now.']

  function render() { text.textContent = PAGES[state.step] }
  function applyPrefs(p) {
    document.documentElement.dataset.motion = p.motion
    document.documentElement.style.fontSize = (16 * (p.textScale || 1)) + 'px'
    document.documentElement.dataset.contrast = p.contrast
  }
  next.addEventListener('click', function () {
    if (state.step >= PAGES.length - 1) { if (session) session.ui.exit(); return }
    state.step += 1
    render()
    if (session) session.progress.commit({ type: 'checkpoint', checkpointId: 'start', set: { step: state.step } }).catch(function () {})
  })
  window.Storyframe.connect({ storyId: STORY_ID, releaseId: RELEASE_ID }).then(function (s) {
    session = s
    return s.ready()
  }).then(function (boot) {
    applyPrefs(boot.preferences)
    session.preferences.onChange(applyPrefs)
    if (boot.progress && boot.progress.storyState) state.step = Number(boot.progress.storyState.step || 0)
    render()
  })
})()
`

const NATIVE_CSS = `body { font-family: Georgia, serif; max-width: 36em; margin: 3rem auto; padding: 0 1rem; line-height: 1.7; }
html[data-contrast="more"] body { color: #000; }
html[data-motion="reduced"] *, html[data-motion="none"] * { animation: none !important; transition: none !important; }
button { font: inherit; padding: .6em 1.2em; }
:focus-visible { outline: 3px solid #1d58b8; outline-offset: 3px; }
`

const WRAP_ORIGINAL = (title) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
</head>
<body>
<!-- Paste your existing single-file story's <body> content here.
     Wrap its start-up code as window.__START_APP__ = function () { … }
     and end it with: if (!window.__SF_DEFER__) window.__START_APP__() -->
<main><h1>${title}</h1><p id="out">Your existing story.</p></main>
`

const WRAP_GLUE = (storyId) => `<script>
/* Storyframe glue — the Tulip pattern (docs/BOOK-AUTHORING.md §Wrap).
   Opened directly, none of this runs and your story behaves as before. */
(function () {
  'use strict'
  var STORY_ID = '${storyId}'
  var RELEASE_ID = document.documentElement.getAttribute('data-sf-release') || 'dev'
  var framed = window.parent && window.parent !== window
  if (!framed || !/[#&]sf_nonce=/.test(location.hash) || !window.Storyframe) return
  window.__SF_DEFER__ = true                       // 1. defer your story's start

  window.Storyframe.connect({ storyId: STORY_ID, releaseId: RELEASE_ID }).then(function (session) {
    return session.ready().then(function (boot) {
      window.__SF_BOOT__ = (boot.progress && boot.progress.storyState) || {}   // 2. restore
      if (window.__START_APP__) window.__START_APP__()
      session.preferences.onChange(function (p) {                             // 4. preferences
        document.documentElement.dataset.motion = p.motion
      })
      document.addEventListener('sf:checkpoint', function (e) {               // 3. commit moments
        session.progress.commit({ type: 'checkpoint', checkpointId: e.detail.id, set: e.detail.state || {} }).catch(function () {})
      })
    })
  }).catch(function () {
    window.__SF_DEFER__ = false
    if (window.__START_APP__) window.__START_APP__()
  })
})()
</script>
`

const WRAP_END = `<script>
window.__START_APP__ = window.__START_APP__ || function () {
  document.getElementById('out').textContent = 'Started' + (window.__SF_BOOT__ ? ' (restored)' : '')
  document.dispatchEvent(new CustomEvent('sf:checkpoint', { detail: { id: 'start', state: { started: true } } }))
}
if (!window.__SF_DEFER__) window.__START_APP__()
</script>
</body>
</html>
`

/**
 * @param {{ slug:string, template:'quick'|'native'|'wrap', storyId:string, title?:string }} o
 * @returns {Map<string, Uint8Array>}
 */
export function scaffoldStory({ slug, template, storyId, title }) {
  if (!TEMPLATES.includes(template)) throw new Error(`template must be one of ${TEMPLATES.join(', ')}`)
  const t = title ?? titleFromSlug(slug)
  const manifest = baseManifest({ storyId, slug, title: t, template })
  const files = new Map()
  const put = (p, s) => files.set(p, toBytes(s))
  put('storyframe.json', JSON.stringify(manifest, null, 2) + '\n')
  put('cover.svg', generateCover({ title: t, palette: template === 'quick' ? 'manuscript' : 'dusk', motif: template === 'quick' ? 'lantern' : 'horizon' }).svg)
  put('CHANGELOG.md', `# Changelog\n\n## 0.1.0\n\nFirst draft.\n`)
  put('README.md', `# ${t}\n\nA Storyframe book (${template} lane).\n\n\`\`\`\nnpm run storyframe -- build stories/${slug}\nnpm run storyframe -- validate stories/${slug}\nnpm run storyframe -- publish stories/${slug} --channel beta\n\`\`\`\n\nSee docs/BOOK-AUTHORING.md.\n`)
  if (template === 'quick') put('book.md', QUICK_BOOK(t))
  if (template === 'native') {
    put('src/index.html', NATIVE_HTML(t))
    put('src/story.js', NATIVE_JS(storyId))
    put('src/style.css', NATIVE_CSS)
  }
  if (template === 'wrap') {
    put('src/00-original.html', WRAP_ORIGINAL(t))
    put('src/45-storyframe-glue.html', WRAP_GLUE(storyId))
    put('src/99-end.html', WRAP_END)
  }
  return files
}

<script>
/* ══════════════════════════════════════════════════════════════════
   Storyframe integration for THE TULIP & THE JESTER.

   The story stays a self-contained page. When it runs inside the
   Storyframe shell (an sf_nonce rides the URL fragment) this glue:
     1. defers app start until the platform bootstrap arrives,
     2. restores read parts / found secrets from the reader's snapshot,
     3. forwards the story's own events as atomic progress commits,
     4. applies live accessibility preferences from the host.

   Opened directly, none of this runs and the story behaves exactly
   as it always did. The story never sees tokens or reader identity.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict'
  var STORY_ID = '6f9f2c6a-3d5e-4b1c-9a52-1f4be8a30d17'
  var RELEASE_ID = document.documentElement.getAttribute('data-sf-release') || 'dev'

  var framed = window.parent && window.parent !== window
  var hasNonce = /[#&]sf_nonce=/.test(location.hash)
  if (!framed || !hasNonce || !window.Storyframe) return   // standalone: change nothing

  window.__SF_DEFER__ = true

  var CHECKPOINTS = {
    'part-1': ['part-1', 10], 'part-2': ['part-2', 20], 'part-3': ['part-3', 30],
    'part-4': ['part-4', 40], 'part-5': ['part-5', 50], 'part-6': ['part-6', 60],
    'part-7': ['part-7', 70], 'part-8': ['part-8', 80], 'part-9': ['part-9', 90],
    'part-10': ['part-10', 100],
  }
  var SECRET_ITEMS = ['candle', 'part-1:3', 'part-4:2', 'part-5:3', 'part-7:2', 'garden:41', 'part-10:4']

  function applyPrefs(p) {
    try {
      if (p.textScale && p.textScale !== 1) document.documentElement.style.fontSize = (16 * p.textScale) + 'px'
      if (p.motion && p.motion !== 'full') document.documentElement.dataset.motion = 'off'
      document.dispatchEvent(new CustomEvent('sf:prefs', { detail: p }))
    } catch (e) { /* preferences must never break the story */ }
  }

  window.Storyframe.connect({ storyId: STORY_ID, releaseId: RELEASE_ID }).then(function (session) {
    return session.ready().then(function (boot) {
      var snap = boot.progress || null
      var state = (snap && snap.storyState) || {}
      window.__SF_BOOT__ = {
        read: Array.isArray(state.read) ? state.read : [],
        secrets: Array.isArray(state.secrets) ? state.secrets : [],
        rollDone: !!state.rollDone,
      }
      if (boot.preferences) {
        if (boot.preferences.motion !== 'full') document.documentElement.dataset.motion = 'off'
        if (boot.preferences.textScale && boot.preferences.textScale !== 1)
          document.documentElement.style.fontSize = (16 * boot.preferences.textScale) + 'px'
      }

      // hand the stage to the story
      var read = new Set(window.__SF_BOOT__.read)
      var secrets = new Set(window.__SF_BOOT__.secrets)
      location.hash = read.size > 0 ? '#/story' : '#/'
      window.__START_APP__()
      session.preferences.onChange(applyPrefs)

      function commit(mutation) {
        session.progress.commit(mutation).catch(function () { /* the shell shows sync status; play continues */ })
      }

      document.addEventListener('sf:read', function (e) {
        var id = e.detail && e.detail.id
        var cp = CHECKPOINTS[id]
        if (!cp || read.has(id)) return
        read.add(id)
        var m = {
          type: 'checkpoint', checkpointId: cp[0],
          set: { read: Array.from(read), secrets: Array.from(secrets) },
          visit: [id],
        }
        if (read.size === 10) m.unlockAchievements = ['the-whole-house']
        commit(m)
      })

      document.addEventListener('sf:read-all', function () {
        Object.keys(CHECKPOINTS).forEach(function (id) { read.add(id) })
        commit({
          type: 'checkpoint', checkpointId: 'part-10',
          set: { read: Array.from(read), secrets: Array.from(secrets) },
          unlockAchievements: ['the-whole-house'],
        })
      })

      document.addEventListener('sf:secret', function (e) {
        var key = e.detail && e.detail.key
        if (!key || secrets.has(key) || SECRET_ITEMS.indexOf(key) === -1) return
        secrets.add(key)
        var m = {
          type: 'discovery',
          set: { secrets: Array.from(secrets) },
          grantItems: [{ itemId: key, quantity: 1 }],
        }
        if (secrets.size === SECRET_ITEMS.length) m.unlockAchievements = ['every-hidden-thing']
        commit(m)
      })

      document.addEventListener('sf:roll-complete', function () {
        commit({
          type: 'ending', endingId: 'the-final-page', checkpointId: 'final',
          set: { rollDone: true },
          unlockAchievements: ['say-them-out-loud'],
        })
      })

      session.lifecycle.on('closing', function () { /* nothing held open */ })
    })
  }).catch(function () {
    // Handshake failed: run standalone rather than showing a dead page.
    window.__SF_DEFER__ = false
    if (window.__START_APP__) window.__START_APP__()
  })
})()
</script>

/* NEON HORIZON — story logic.
   Written the way the author guide says to: plain JS, the SDK for saves,
   semantic checkpoints, a hint ladder with an accessible bypass, and no
   timers anywhere, so "untimed" is simply true. */
(function () {
  'use strict'
  var STORY_ID = '2b4dfd0e-91c8-45c0-8a3e-6f0a5cf6f2aa'
  var RELEASE_ID = document.documentElement.getAttribute('data-sf-release') || 'dev'
  var CODE = '741'                       // deducible from the three log fragments

  var S = {
    node: 'boot',                        // boot → hall → aligned → decided
    listens: 0, hints: 0, aligned: false,
    inventory: {}, choices: {}, endings: [],
  }
  var session = null

  /* ── console plumbing ─────────────────────────────────────────────── */
  var log = document.getElementById('log')
  var quick = document.getElementById('quick')
  var form = document.getElementById('f')
  var cmd = document.getElementById('cmd')

  function line(text, cls) {
    var p = document.createElement('p')
    p.className = 'line' + (cls ? ' ' + cls : '')
    p.textContent = text
    log.appendChild(p)
    log.parentElement.scrollTop = log.parentElement.scrollHeight
  }
  function block(lines, cls) { lines.forEach(function (t) { line(t, cls) }) }
  function setQuick(buttons) {
    quick.innerHTML = ''
    buttons.forEach(function (b) {
      var el = document.createElement('button')
      el.type = 'button'; el.textContent = b[0]
      el.addEventListener('click', function () { handle(b[1]) })
      quick.appendChild(el)
    })
  }

  /* ── saving ───────────────────────────────────────────────────────── */
  function snapState() {
    return { node: S.node, listens: S.listens, hints: S.hints, aligned: S.aligned }
  }
  function commit(extra) {
    if (!session) return
    var m = Object.assign({ type: 'state_patch', set: snapState() }, extra || {})
    session.progress.commit(m).catch(function () { /* shell shows sync state */ })
  }

  /* ── scenes ───────────────────────────────────────────────────────── */
  function sceneBoot(resumed) {
    block([
      '┌──────────────────────────────────────┐',
      '│  K-19 ORBITAL RELAY — DARK 11 YEARS  │',
      '└──────────────────────────────────────┘',
    ], 'art')
    if (resumed) {
      line('SESSION RESTORED. The station remembered you.', 'warn')
    } else {
      block([
        'Emergency lights the colour of pond water. Your breath fogs the console.',
        'Eleven years since anyone docked here. The maintenance AI greets you',
        'with a single line, then dies again:',
        '', '  «someone is still broadcasting on the old band»', '',
      ], 'sys')
    }
    line('You are in the RELAY HALL. Type LOOK, or press a button below.')
    setQuick([['LOOK', 'look'], ['LISTEN', 'listen'], ['EXAMINE DESK', 'examine desk'], ['HELP', 'help']])
    if (S.node === 'boot') { S.node = 'hall'; commit({ checkpointId: 'hall', visit: ['hall'] }) }
  }

  function look() {
    if (S.node === 'decided') return line('The hall is quiet now. The choice is made.', 'sys')
    block([
      'The relay hall is a drum of frost and cable. Three things hold light:',
      '  · the ALIGNMENT CONSOLE, wheel dials frozen mid-turn',
      '  · a steel DESK, drawers forced once, long ago',
      '  · the LISTENING horn, patched with tape and hope',
      S.aligned ? 'The console hums, aligned. The old band is OPEN.' : 'The console blinks a three-digit demand: [ ▢ ▢ ▢ ]',
    ])
  }

  function listen() {
    S.listens += 1
    if (!S.aligned) {
      var lines = [
        'Static. Under it — maybe — a rhythm. Like someone tapping a rail.',
        'Static, and one clean tone that dies as you reach for the gain.',
        'Static. But the rhythm is BACK, and it is not random. It counts.',
      ]
      line(lines[Math.min(S.listens - 1, 2)], 'sys')
      if (S.listens === 3 && session) {
        session.achievements.unlock('listener').catch(function () {})
        line('· achievement: A PATIENT EAR ·', 'warn')
      }
      commit()
    } else {
      line(S.node === 'decided'
        ? 'The open band hums, content. You listen a while. It counts, still.'
        : 'The open band carries a voice now. It is asking you to decide.', 'warn')
      commit()   // listens are story state even after the band is open
    }
  }

  function examine(what) {
    if (/desk/.test(what)) {
      if (!S.inventory['logbook-page']) {
        S.inventory['logbook-page'] = true
        block([
          'The drawer gives. Inside: one LOGBOOK PAGE, three entries circled —',
          '  “power at SEVEN tenths and holding”',
          '  “four dishes still answer roll call”',
          '  “one operator remains. me.”',
        ], 'sys')
        line('· logbook page added to your archive ·', 'warn')
        commit({ grantItems: [{ itemId: 'logbook-page', quantity: 1 }], visit: ['desk'] })
      } else {
        line('The page is in your archive. Seven tenths. Four dishes. One operator.', 'sys')
      }
      return
    }
    if (/console/.test(what)) {
      line(S.aligned ? 'Aligned. Humming. Open.' : 'Three dials, one demand: ALIGN ###. The logbook knew the numbers once.', 'sys')
      return
    }
    line('Nothing more to learn from that.', 'sys')
  }

  var HINTS = [
    'The hall is patient. Somewhere in here, somebody wrote things down.',          // atmospheric
    'The logbook page circles three quantities. Read them in order.',               // directional
    'Seven tenths. Four dishes. One operator. ALIGN 741.',                          // explicit
  ]
  function hint() {
    if (S.aligned) return line('No hints needed — the band is open.', 'sys')
    if (S.hints < 3) {
      line('HINT ' + (S.hints + 1) + '/3: ' + HINTS[S.hints], 'warn')
      S.hints += 1
      commit({ hintLevel: { puzzleId: 'alignment', level: S.hints } })
    } else {
      line('BYPASS available: type ALIGN AUTO and the station will do it for you.', 'warn')
      commit({ hintLevel: { puzzleId: 'alignment', level: 4 } })
    }
  }

  function align(arg) {
    if (S.aligned) return line('Already aligned.', 'sys')
    var auto = /auto/.test(arg)
    if (!auto && arg.replace(/\D/g, '') !== CODE) {
      line('The dials refuse: ' + (arg || '···') + ' is not the shape of the signal.', 'alert')
      line('(HINT is available, and costs you nothing.)', 'sys')
      return
    }
    S.aligned = true
    S.node = 'aligned'
    block([
      auto ? 'The station aligns itself, gently, like a nurse taking a glass from your hand.' : 'Dial by dial: 7 · 4 · 1. The hall exhales.',
      '',
      'The old band opens. The rhythm resolves into a voice — young, tired,',
      'broadcasting from the dark side of the horizon for eleven years:',
      '',
      '  «if anyone hears this — the relay can still reach the colony ships.',
      '   one full transmission. the coil will burn out doing it.',
      '   or keep the station alive, and keep me company. your call.»',
    ], 'sys')
    var m = {
      type: 'puzzle_completed', puzzleId: 'alignment', checkpointId: 'aligned',
      set: snapState(), grantItems: [{ itemId: 'coil', quantity: 1 }], visit: ['aligned'],
    }
    if (S.hints === 0) m.unlockAchievements = ['clean-signal']
    if (session) session.progress.commit(m).catch(function () {})
    line('')
    line('Type TRANSMIT to burn the coil. Type STAY to keep the light on.', 'warn')
    setQuick([['TRANSMIT', 'transmit'], ['STAY', 'stay'], ['LISTEN', 'listen'], ['LOOK', 'look']])
  }

  function decide(option) {
    if (!S.aligned) return line('The band is not open yet. ALIGN the console first.', 'alert')
    if (S.node === 'decided') return line('The choice is made. It stays made.', 'sys')
    S.node = 'decided'
    var ending = option === 'transmit' ? 'signal-sent' : 'kept-company'
    if (option === 'transmit') {
      block([
        'You send it all: coordinates, the voice, eleven years of counting.',
        'The coil glows white, sings one note, and dies. So does the hall light.',
        'In the dark, on the last of the batteries, the old band whispers:',
        '', '  «they heard. thank you. it was worth the quiet.»', '',
        '════ ENDING: THE SIGNAL, SENT ════',
      ], 'sys')
    } else {
      block([
        'You do not burn the coil. You route power to the heaters instead,',
        'and key the microphone, and say the first word the station has',
        'carried in eleven years that was not a number:', '', '  «hello.»', '',
        'Somewhere past the horizon, somebody laughs, and starts to cry.',
        '', '════ ENDING: KEPT COMPANY ════',
      ], 'sys')
    }
    if (session) {
      session.progress.commit({
        type: 'ending', endingId: ending, checkpointId: 'decided',
        choiceId: 'final-call', choiceOption: option, set: snapState(),
      }).catch(function () {})
    }
    line('')
    line('You can EXIT to your shelf, or LISTEN a while longer.', 'warn')
    setQuick([['EXIT TO SHELF', 'exit'], ['LISTEN', 'listen']])
  }

  function help() {
    block([
      'COMMANDS: LOOK · LISTEN · EXAMINE <thing> · ALIGN <###> · HINT · HELP',
      'After the band opens: TRANSMIT or STAY. EXIT returns to your shelf.',
      'Everything is untimed. Nothing here punishes waiting.',
    ], 'sys')
  }

  function handle(raw) {
    var input = String(raw || '').trim().toLowerCase()
    if (!input) return
    line('> ' + input.toUpperCase(), 'you')
    if (input === 'look') return look()
    if (input === 'listen') return listen()
    if (input.indexOf('examine') === 0) return examine(input.slice(7).trim() || 'hall')
    if (input.indexOf('align') === 0) return align(input.slice(5).trim())
    if (input === 'hint') return hint()
    if (input === 'help') return help()
    if (input === 'transmit') return decide('transmit')
    if (input === 'stay') return decide('stay')
    if (input === 'exit' || input === 'exit to shelf') { if (session) session.ui.exit(); return }
    line('Unknown command. HELP lists what the console understands.', 'alert')
  }

  form.addEventListener('submit', function (e) { e.preventDefault(); handle(cmd.value); cmd.value = '' })

  /* ── preferences from the host ────────────────────────────────────── */
  function applyPrefs(p) {
    if (!p) return
    if (p.motion && p.motion !== 'full') document.documentElement.dataset.motion = 'off'
    else document.documentElement.dataset.motion = 'on'
    if (p.textScale) document.documentElement.style.fontSize = (16 * p.textScale) + 'px'
    if (p.contrast === 'more') document.body.style.setProperty('--phos', '#8dffc4')
  }

  /* ── boot ─────────────────────────────────────────────────────────── */
  window.Storyframe.connect({ storyId: STORY_ID, releaseId: RELEASE_ID }).then(function (s) {
    session = s
    return s.ready()
  }).then(function (boot) {
    applyPrefs(boot.preferences)
    var snap = boot.progress
    var resumed = false
    if (snap && snap.storyState && snap.storyState.node && snap.storyState.node !== 'boot') {
      S.node = String(snap.storyState.node)
      S.listens = Number(snap.storyState.listens || 0)
      S.hints = Number(snap.storyState.hints || 0)
      S.aligned = !!snap.storyState.aligned
      if (snap.inventory && snap.inventory['logbook-page']) S.inventory['logbook-page'] = true
      resumed = true
    }
    if (session.preferences) session.preferences.onChange(applyPrefs)
    sceneBoot(resumed)
    if (resumed && S.aligned && S.node !== 'decided') {
      line('The band is OPEN. The voice is waiting. TRANSMIT or STAY.', 'warn')
      setQuick([['TRANSMIT', 'transmit'], ['STAY', 'stay'], ['LISTEN', 'listen'], ['LOOK', 'look']])
    }
    if (resumed && S.node === 'decided') {
      line('The choice was made. The station keeps its quiet. You can LISTEN, or EXIT.', 'sys')
      setQuick([['EXIT TO SHELF', 'exit'], ['LISTEN', 'listen']])
    }
    cmd.focus()
  }).catch(function () {
    line('HOST LINK FAILED — running on local power only. Saves stay in this tab.', 'alert')
    sceneBoot(false)
  })
})()

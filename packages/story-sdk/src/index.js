/**
 * @storyframe/sdk — the tiny library a story ships with.
 *
 * A story is a normal static web page. When it runs inside the Storyframe
 * shell it finds `sf_nonce` in its URL fragment, performs the §14 handshake,
 * and talks to the host over a private MessagePort. When it is opened
 * directly (an author double-clicking index.html), `connect()` returns a
 * standalone in-memory host with the same API, so the story keeps working
 * with saves that last for the tab — exactly the "fake host" promise.
 *
 * The SDK never sees tokens, cookies, or the parent DOM. It sends nothing
 * sensitive in the wildcard hello (§14.1 opaque mode).
 */

const PROTOCOL = '1.1'                 // newest this SDK speaks
const BASE_PROTOCOL = '1.0'            // what every host accepts in a hello
const ACCEPTS = ['1.0', '1.1']
const SDK_VERSION = '1.1.0'
const HANDSHAKE_TIMEOUT_MS = 4000
const ACK_TIMEOUT_MS = 8000

const uuid = () =>
  (crypto.randomUUID?.() ??
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
    }))

function readNonce() {
  const m = /[#&]sf_nonce=([A-Za-z0-9_-]{16,128})/.exec(location.hash)
  return m ? m[1] : null
}

class Emitter {
  #map = new Map()
  on(event, fn) {
    if (!this.#map.has(event)) this.#map.set(event, new Set())
    this.#map.get(event).add(fn)
    return () => this.#map.get(event)?.delete(fn)
  }
  emit(event, data) { this.#map.get(event)?.forEach((fn) => { try { fn(data) } catch { /* story handler errors stay in the story */ } }) }
}

/* ── the connected (framed) session ─────────────────────────────────── */
function framedSession({ storyId, releaseId, nonce }) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      window.removeEventListener('message', onWelcome)
      reject(new Error('storyframe: handshake timed out'))
    }, HANDSHAKE_TIMEOUT_MS)

    function onWelcome(event) {
      const d = event.data
      if (!d || d.type !== 'STORYFRAME_WELCOME') return
      if (d.nonce !== nonce) return
      if (!event.ports || !event.ports[0]) return
      clearTimeout(timer)
      window.removeEventListener('message', onWelcome)
      // the host picks the version; a 1.0 host answers '1.0' and never sees `accepts`
      const protocol = ACCEPTS.includes(d.protocol) ? d.protocol : BASE_PROTOCOL
      resolve(makePortApi({ port: event.ports[0], storyId, releaseId, sessionId: d.sessionId, capabilities: d.capabilities ?? [], protocol }))
    }
    window.addEventListener('message', onWelcome)

    // The hello carries identity + nonce only — never state, never credentials.
    // Version negotiation: `protocol` stays at the base version every host
    // accepts; `accepts` offers newer ones (ignored by 1.0 hosts).
    window.parent.postMessage(
      { type: 'STORYFRAME_HELLO', protocol: BASE_PROTOCOL, accepts: ACCEPTS, storyId, releaseId, nonce, sdkVersion: SDK_VERSION },
      '*',
    )
  })
}

function makePortApi({ port, storyId, releaseId, sessionId, capabilities, protocol }) {
  let sequence = 0
  let revision = 0
  let bootstrapResolve
  const bootstrapPromise = new Promise((r) => { bootstrapResolve = r })
  const pending = new Map() // messageId -> {resolve, reject, timer}
  const prefs = new Emitter()
  const lifecycle = new Emitter()
  let closed = false

  function envelope(type, payload) {
    return {
      protocol, type, messageId: uuid(), sessionId, storyId, releaseId,
      sequence: sequence++, sentAt: new Date().toISOString(), payload,
    }
  }
  function send(type, payload) {
    if (closed) throw new Error('storyframe: session closed')
    const env = envelope(type, payload)
    port.postMessage(env)
    return env
  }
  function request(type, payload) {
    const env = send(type, payload)
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(env.messageId)
        reject(new Error(`storyframe: no response to ${type}`))
      }, ACK_TIMEOUT_MS)
      pending.set(env.messageId, { resolve, reject, timer })
    })
  }

  port.onmessage = (event) => {
    const env = event.data
    if (!env || typeof env !== 'object') return
    switch (env.type) {
      case 'BOOTSTRAP': {
        revision = env.payload?.revision ?? 0
        bootstrapResolve(env.payload)
        break
      }
      case 'PROGRESS_ACK':
      case 'NOTE_ACK':
      case 'UI_ACK': {
        const inReplyTo = env.payload?.inReplyTo
        const waiter = inReplyTo && pending.get(inReplyTo)
        if (waiter) {
          clearTimeout(waiter.timer)
          pending.delete(inReplyTo)
          if (env.payload?.revision !== undefined) revision = env.payload.revision
          waiter.resolve(env.payload)
        }
        break
      }
      case 'PREFERENCES_CHANGED': prefs.emit('change', env.payload); break
      case 'LIFECYCLE': lifecycle.emit(env.payload?.event ?? 'unknown', env.payload); break
      case 'ERROR': {
        const inReplyTo = env.payload?.inReplyTo
        const waiter = inReplyTo && pending.get(inReplyTo)
        if (waiter) { clearTimeout(waiter.timer); pending.delete(inReplyTo); waiter.reject(new Error(env.payload?.code ?? 'error')) }
        break
      }
    }
  }
  port.start?.()

  const api = {
    mode: 'framed',
    sessionId,
    protocol,
    capabilities,
    get revision() { return revision },
    async ready() {
      send('READY', {})
      return bootstrapPromise
    },
    progress: {
      /** Atomic commit: checkpoint + state + items + achievements in one transaction. */
      commit(mutation) {
        return request('PROGRESS_COMMIT', { operationId: uuid(), baseRevision: revision, mutation })
      },
    },
    achievements: {
      unlock(achievementId) {
        return request('PROGRESS_COMMIT', {
          operationId: uuid(), baseRevision: revision,
          mutation: { type: 'state_patch', unlockAchievements: [achievementId] },
        })
      },
    },
    ui: {
      request(requestName, text) { return request('UI_REQUEST', { request: requestName, text }) },
      toast(text) { return request('UI_REQUEST', { request: 'toast', text }) },
      exit() { return request('UI_REQUEST', { request: 'exit' }) },
    },
    preferences: { onChange: (fn) => prefs.on('change', fn) },
    lifecycle: { on: (event, fn) => lifecycle.on(event, fn) },
    close() { closed = true; try { port.close() } catch { /* already closed */ } },
  }
  // protocol 1.1: reader notes & bookmarks. Present only when the host
  // negotiated 1.1; the host still refuses it without `notes.write`.
  if (protocol === '1.1') {
    api.notes = {
      /** @param {{ anchorId:string, text?:string, kind?:'note'|'bookmark', label?:string }} note */
      add(note) {
        if (!capabilities.includes('notes.write')) return Promise.reject(new Error('capability_denied'))
        return request('NOTE_ADD', note)
      },
    }
  }
  return api
}

/* ── the standalone (authoring / direct-open) session ───────────────── */
function standaloneSession({ storyId, releaseId }) {
  const prefs = new Emitter()
  const lifecycle = new Emitter()
  let revision = 0
  let snapshot = null
  const mem = { achievements: new Set(), inventory: {} }

  const notes = []
  return {
    mode: 'standalone',
    sessionId: 'standalone-' + uuid().slice(0, 8),
    protocol: PROTOCOL,
    capabilities: ['progress.read', 'progress.write', 'inventory.write', 'achievement.unlock', 'choice.commit', 'notes.write'],
    notes: {
      async add(note) { notes.push(note); console.info('[storyframe standalone note]', note); return { status: 'saved', noteId: 'standalone-' + notes.length } },
    },
    get revision() { return revision },
    async ready() {
      return {
        resume: false, revision,
        preferences: {
          colorScheme: 'system', contrast: 'normal',
          motion: matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'full',
          textScale: 1, lineHeight: 'normal', fontMode: 'story', sound: 'muted',
          captions: true, puzzleAssist: 'standard', locale: 'en',
        },
        progress: null,
        standalone: true,
      }
    },
    progress: {
      async commit(mutation) {
        revision += 1
        snapshot = { ...(snapshot ?? {}), lastMutation: mutation }
        return { status: 'accepted', sync: 'standalone', revision }
      },
    },
    achievements: { async unlock(id) { mem.achievements.add(id); revision += 1; return { status: 'accepted', sync: 'standalone', revision } } },
    ui: {
      async request(r, text) { if (r === 'toast') console.info('[storyframe standalone toast]', text); return { status: 'ok' } },
      async toast(text) { console.info('[storyframe standalone toast]', text); return { status: 'ok' } },
      async exit() { return { status: 'ok' } },
    },
    preferences: { onChange: (fn) => prefs.on('change', fn) },
    lifecycle: { on: (event, fn) => lifecycle.on(event, fn) },
    close() { /* nothing to close */ },
  }
}

/* ── public entry ───────────────────────────────────────────────────── */
export const Storyframe = {
  protocol: PROTOCOL,
  version: SDK_VERSION,
  /**
   * Connect to the host if framed with a nonce; otherwise return a
   * standalone in-memory host so the story runs on its own.
   */
  async connect({ storyId, releaseId }) {
    const nonce = readNonce()
    const framed = window.parent && window.parent !== window
    if (framed && nonce) return framedSession({ storyId, releaseId, nonce })
    return standaloneSession({ storyId, releaseId })
  },
}

export default Storyframe
if (typeof window !== 'undefined') window.Storyframe = Storyframe

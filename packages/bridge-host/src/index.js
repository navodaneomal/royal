/**
 * @storyframe/bridge-host — the parent side of the secure story bridge (§14).
 *
 * Two frame modes:
 *  - `cross-origin-online`: the story is served from the story origin.
 *    The hello must arrive with `event.origin === expectedOrigin`.
 *  - `opaque-offline`: a verified single-file package runs from a Blob URL
 *    inside `sandbox="allow-scripts"` (no allow-same-origin). Its origin is
 *    the literal string "null", so identity rests on the exact
 *    `event.source`, the unguessable one-use nonce, and a schema-valid
 *    hello. The welcome uses targetOrigin '*' and carries NO reader data —
 *    the private MessagePort carries everything after that.
 *
 * The host never sends tokens or credentials into the frame in either mode.
 */
import {
  HelloSchema, validateEnvelope, byteLength,
  MAX_MESSAGE_BYTES, ProgressCommitPayload, UiRequestPayload, PreferencesSchema,
} from '@storyframe/protocol'

const RATE_WINDOW_MS = 1000
const RATE_MAX_MESSAGES = 60          // a story has no business exceeding this
const MAX_INVALID_BEFORE_CLOSE = 10

export function randomNonce() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'[b % 64]).join('')
}

/**
 * Create the bridge for one player session.
 *
 * @param {object} options
 * @param {HTMLIFrameElement} options.iframe    already in the document, src NOT yet set
 * @param {'cross-origin-online'|'opaque-offline'} options.mode
 * @param {string} options.src                  entrypoint URL (online) or blob URL (offline)
 * @param {object} options.release              { storyId, releaseId, manifest, capabilities }
 * @param {object} options.callbacks            host services the story may reach
 *   onCommit(payload) -> Promise<ack payload>       (validated, capability-checked here first)
 *   onUiRequest(payload) -> Promise<ack payload>
 *   onEvent(name, data)                             telemetry/diagnostics hook
 * @param {object} options.bootstrap            { preferences, progress, revision, resume }
 */
export function createStoryBridge({ iframe, mode, src, release, callbacks, bootstrap }) {
  const nonce = randomNonce()
  const sessionId = 'sess-' + randomNonce().slice(0, 16)
  const expectedOrigin = mode === 'cross-origin-online' ? new URL(src).origin : 'null'
  const granted = new Set(release.capabilities)

  let port = null
  let hostSequence = 0
  let lastStorySequence = -1
  let invalidCount = 0
  let closed = false
  const rate = []
  const listeners = { status: new Set() }

  const diagnosticId = 'sf-' + Math.random().toString(36).slice(2, 10)
  const emit = (name, data) => { try { callbacks.onEvent?.(name, { ...data, sessionId, diagnosticId }) } catch { /* diagnostics never break play */ } }
  const setStatus = (s, extra) => listeners.status.forEach((fn) => fn(s, extra))

  function envelope(type, payload) {
    return {
      protocol: '1.0', type, messageId: crypto.randomUUID(), sessionId,
      storyId: release.storyId, releaseId: release.releaseId,
      sequence: hostSequence++, sentAt: new Date().toISOString(), payload,
    }
  }
  const post = (type, payload) => { if (port && !closed) port.postMessage(envelope(type, payload)) }

  /* ── the handshake listener ─────────────────────────────────────── */
  function onHello(event) {
    if (closed || port) return
    // 1. exact frame identity — the single strongest check in opaque mode
    if (event.source !== iframe.contentWindow) return
    // 2. origin discipline per mode
    if (event.origin !== expectedOrigin) { emit('bridge_hello_rejected', { code: 'origin', got: event.origin }); return }
    // 3. schema-valid hello
    const hello = HelloSchema.safeParse(event.data)
    if (!hello.success) { emit('bridge_hello_rejected', { code: 'schema' }); return }
    // 4. one-use unguessable nonce + release identity
    if (hello.data.nonce !== nonce) { emit('bridge_hello_rejected', { code: 'nonce' }); return }
    if (hello.data.storyId !== release.storyId) { emit('bridge_hello_rejected', { code: 'story' }); return }
    if (hello.data.releaseId !== release.releaseId) { emit('bridge_hello_rejected', { code: 'release' }); return }

    window.removeEventListener('message', onHello)
    const channel = new MessageChannel()
    port = channel.port1
    port.onmessage = onPortMessage

    // Welcome: exact origin online; '*' for the opaque frame — and therefore
    // NEVER any reader data in this message. The port carries the rest.
    const welcome = { type: 'STORYFRAME_WELCOME', nonce, sessionId, protocol: '1.0', capabilities: [...granted] }
    iframe.contentWindow.postMessage(welcome, mode === 'cross-origin-online' ? expectedOrigin : '*', [channel.port2])
    emit('bridge_ready', { mode })
    setStatus('connected')
  }

  /* ── port traffic ───────────────────────────────────────────────── */
  function invalid(code, detail) {
    invalidCount += 1
    emit('bridge_invalid_message', { code, detail })
    if (invalidCount >= MAX_INVALID_BEFORE_CLOSE) close('too_many_invalid')
  }

  async function onPortMessage(event) {
    if (closed) return
    const now = Date.now()
    while (rate.length && now - rate[0] > RATE_WINDOW_MS) rate.shift()
    rate.push(now)
    if (rate.length > RATE_MAX_MESSAGES) return invalid('rate_limited')

    if (byteLength(event.data ?? {}) > MAX_MESSAGE_BYTES) return invalid('oversized')
    const checked = validateEnvelope(event.data, {
      expect: { storyId: release.storyId, releaseId: release.releaseId, sessionId },
    })
    if (!checked.ok) return invalid(checked.code, checked.detail)
    const env = checked.envelope

    if (env.sequence <= lastStorySequence) return invalid('sequence_replay')
    lastStorySequence = env.sequence

    switch (env.type) {
      case 'READY': {
        // The one place reader data crosses: over the private port only.
        post('BOOTSTRAP', {
          resume: bootstrap.resume,
          revision: bootstrap.revision,
          preferences: PreferencesSchema.parse(bootstrap.preferences ?? {}),
          progress: bootstrap.progress ?? null,
          capabilities: [...granted],
        })
        emit('bootstrap_sent', {})
        break
      }
      case 'PROGRESS_COMMIT': {
        const payload = ProgressCommitPayload.safeParse(env.payload)
        if (!payload.success) return invalid('commit_schema', payload.error.issues[0]?.message)
        if (!granted.has('progress.write')) {
          post('ERROR', { inReplyTo: env.messageId, code: 'capability_denied' })
          return emit('capability_denied', { capability: 'progress.write' })
        }
        const m = payload.data.mutation
        if (m.grantItems?.length && !granted.has('inventory.write'))
          return post('ERROR', { inReplyTo: env.messageId, code: 'capability_denied' })
        if (m.unlockAchievements?.length && !granted.has('achievement.unlock'))
          return post('ERROR', { inReplyTo: env.messageId, code: 'capability_denied' })
        if (m.choiceId !== undefined && !granted.has('choice.commit'))
          return post('ERROR', { inReplyTo: env.messageId, code: 'capability_denied' })
        try {
          setStatus('saving')
          const ack = await callbacks.onCommit(payload.data)
          post('PROGRESS_ACK', { inReplyTo: env.messageId, ...ack })
          setStatus(ack.sync === 'conflict' ? 'conflict' : 'saved', ack)
        } catch (err) {
          post('ERROR', { inReplyTo: env.messageId, code: 'commit_failed' })
          setStatus('error', { message: String(err?.message ?? err) })
          emit('commit_failed', { error: String(err?.message ?? err) })
        }
        break
      }
      case 'UI_REQUEST': {
        const payload = UiRequestPayload.safeParse(env.payload)
        if (!payload.success) return invalid('ui_schema')
        if (payload.data.request === 'fullscreen' && !granted.has('ui.fullscreen'))
          return post('ERROR', { inReplyTo: env.messageId, code: 'capability_denied' })
        const ack = (await callbacks.onUiRequest?.(payload.data)) ?? { status: 'ok' }
        post('UI_ACK', { inReplyTo: env.messageId, ...ack })
        break
      }
      case 'ERROR': emit('story_reported_error', { payload: env.payload }); break
      default: invalid('unknown_type', env.type)
    }
  }

  /* ── public control surface ─────────────────────────────────────── */
  function close(reason = 'exit') {
    if (closed) return
    closed = true
    window.removeEventListener('message', onHello)
    try { post('LIFECYCLE', { event: 'closing', reason }) } catch { /* port may be gone */ }
    try { port?.close() } catch { /* already closed */ }
    port = null
    emit('bridge_closed', { reason })
    setStatus('closed', { reason })
  }

  window.addEventListener('message', onHello)
  const handshakeTimer = setTimeout(() => {
    if (!port && !closed) { emit('bridge_handshake_timeout', {}); setStatus('handshake_timeout') }
  }, 6000)

  // boot the frame — nonce rides the fragment, never a query (§33)
  iframe.src = src + '#sf_nonce=' + nonce

  return {
    sessionId, diagnosticId, nonce,
    close,
    sendPreferences: (preferences) => post('PREFERENCES_CHANGED', PreferencesSchema.parse(preferences)),
    sendLifecycle: (event) => post('LIFECYCLE', { event }),
    onStatus: (fn) => { listeners.status.add(fn); return () => listeners.status.delete(fn) },
    get connected() { return !!port && !closed },
    _cleanupTimer: handshakeTimer,
  }
}

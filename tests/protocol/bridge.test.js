/* The real bridge-host over real MessageChannels (Node has them), with a
   stand-in window + iframe. Proves protocol 1.1 negotiation and notes, and
   that a 1.0 story — hello without `accepts` — works exactly as before. */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createStoryBridge } from '@storyframe/bridge-host'

const STORY = '2b4dfd0e-91c8-45c0-8a3e-6f0a5cf6f2aa'
const RELEASE = 'rabcdef123456'
const tick = (ms = 15) => new Promise((r) => setTimeout(r, ms))

let listeners
beforeEach(() => {
  listeners = []
  globalThis.window = {
    addEventListener: (t, fn) => { if (t === 'message') listeners.push(fn) },
    removeEventListener: (t, fn) => { listeners = listeners.filter((l) => l !== fn) },
  }
})
afterEach(() => { delete globalThis.window })

function harness({ capabilities = ['progress.write', 'notes.write'], onNote } = {}) {
  const story = { port: null, welcome: null, inbox: [] }
  const contentWindow = {
    postMessage(msg, _origin, ports) { story.welcome = msg; story.port = ports?.[0]; story.port.onmessage = (e) => story.inbox.push(e.data) },
  }
  const iframe = { contentWindow, set src(v) { this._src = v }, get src() { return this._src } }
  const events = []
  const trace = []
  const bridge = createStoryBridge({
    iframe, mode: 'opaque-offline', src: 'blob:null/abc',
    release: { storyId: STORY, releaseId: RELEASE, capabilities },
    bootstrap: { resume: false, revision: 0, preferences: {}, progress: null },
    callbacks: {
      onCommit: async () => ({ status: 'accepted', revision: 1 }),
      onNote: onNote ?? (async (n) => ({ noteId: 'n1', echo: n.text })),
      onEvent: (name, data) => events.push([name, data]),
      onTrace: (dir, msg) => trace.push([dir, msg.type]),
    },
  })
  const nonce = iframe.src.split('#sf_nonce=')[1]
  const hello = (extra = {}) => listeners.forEach((fn) => fn({
    source: contentWindow, origin: 'null',
    data: { type: 'STORYFRAME_HELLO', protocol: '1.0', storyId: STORY, releaseId: RELEASE, nonce, ...extra },
  }))
  let seq = 0
  const send = (type, payload, protocol) => story.port.postMessage({
    protocol: protocol ?? story.welcome.protocol, type, messageId: crypto.randomUUID(), sessionId: story.welcome.sessionId,
    storyId: STORY, releaseId: RELEASE, sequence: seq++, sentAt: new Date().toISOString(), payload,
  })
  return { bridge, story, hello, send, events, trace }
}

describe('protocol negotiation', () => {
  it('a 1.0 story (no accepts) gets a 1.0 session and plays as before', async () => {
    const h = harness()
    h.hello()
    expect(h.story.welcome.protocol).toBe('1.0')
    expect(h.story.welcome).not.toHaveProperty('preferences')      // opaque welcome carries no reader data
    h.send('READY', {})
    await tick()
    expect(h.story.inbox[0].type).toBe('BOOTSTRAP')
    h.send('PROGRESS_COMMIT', { operationId: crypto.randomUUID(), baseRevision: 0, mutation: { type: 'state_patch' } })
    await tick()
    expect(h.story.inbox.at(-1).type).toBe('PROGRESS_ACK')
    expect(h.story.inbox.at(-1).protocol).toBe('1.0')
    h.bridge.close()
  })
  it('a 1.1 SDK negotiates 1.1 via accepts', () => {
    const h = harness()
    h.hello({ accepts: ['1.0', '1.1', '9.9'] })
    expect(h.story.welcome.protocol).toBe('1.1')
    expect(h.bridge.protocol).toBe('1.1')
    h.bridge.close()
  })
  it('rejects envelopes that switch protocol mid-session', async () => {
    const h = harness()
    h.hello()
    h.send('READY', {}, '1.1')
    await tick()
    expect(h.events.find(([n, d]) => n === 'bridge_invalid_message' && d.code === 'protocol_mismatch')).toBeTruthy()
    h.bridge.close()
  })
})

describe('notes (protocol 1.1)', () => {
  it('saves a note when negotiated 1.1 and notes.write is granted', async () => {
    const h = harness()
    h.hello({ accepts: ['1.0', '1.1'] })
    h.send('NOTE_ADD', { anchorId: 'storm', text: 'the lamp breathes', kind: 'note' })
    await tick()
    const ack = h.story.inbox.at(-1)
    expect(ack.type).toBe('NOTE_ACK')
    expect(ack.payload).toMatchObject({ status: 'saved', noteId: 'n1', echo: 'the lamp breathes' })
    expect(h.trace.map(([d, t]) => `${d}:${t}`)).toEqual(expect.arrayContaining(['in:NOTE_ADD', 'out:NOTE_ACK']))
    h.bridge.close()
  })
  it('refuses notes without the capability — per message, bridge stays open', async () => {
    const h = harness({ capabilities: ['progress.write'] })
    h.hello({ accepts: ['1.1'] })
    h.send('NOTE_ADD', { anchorId: 'a', text: 'x' })
    await tick()
    expect(h.story.inbox.at(-1).payload.code).toBe('capability_denied')
    expect(h.bridge.connected).toBe(true)
    h.bridge.close()
  })
  it('treats NOTE_ADD as unknown in a 1.0 session', async () => {
    const h = harness()
    h.hello()
    h.send('NOTE_ADD', { anchorId: 'a', text: 'x' })
    await tick()
    expect(h.events.find(([n, d]) => n === 'bridge_invalid_message' && d.code === 'unknown_type')).toBeTruthy()
    h.bridge.close()
  })
  it('validates note payloads (size cap)', async () => {
    const h = harness()
    h.hello({ accepts: ['1.1'] })
    h.send('NOTE_ADD', { anchorId: 'a', text: 'x'.repeat(2001) })
    await tick()
    expect(h.events.find(([n, d]) => n === 'bridge_invalid_message' && d.code === 'note_schema')).toBeTruthy()
    h.bridge.close()
  })
})

describe('hello discipline (unchanged from 1.0)', () => {
  it('ignores a hello from the wrong source or with the wrong nonce', () => {
    const h = harness()
    listeners.forEach((fn) => fn({ source: {}, origin: 'null', data: { type: 'STORYFRAME_HELLO', protocol: '1.0', storyId: STORY, releaseId: RELEASE, nonce: 'x'.repeat(24) } }))
    h.hello({ nonce: 'A'.repeat(24) })
    expect(h.story.welcome).toBeNull()
    expect(h.events.find(([n, d]) => n === 'bridge_hello_rejected' && d.code === 'nonce')).toBeTruthy()
    h.bridge.close()
  })
})

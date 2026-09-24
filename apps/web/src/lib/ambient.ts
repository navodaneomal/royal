/* P3: an optional ambient room tone for the shell — generated brown noise
   through a low-pass filter, very quiet. Never plays inside a story, never
   without the reader's explicit "sound: on" AND the ambient switch. */
let ctx: AudioContext | null = null
let gain: GainNode | null = null

export function setAmbient(on: boolean) {
  if (!on) {
    if (gain && ctx) gain.gain.setTargetAtTime(0, ctx.currentTime, 0.4)
    setTimeout(() => { if (ctx && gain && gain.gain.value < 0.001) { ctx.suspend().catch(() => {}) } }, 1500)
    return
  }
  try {
    if (!ctx) {
      ctx = new AudioContext()
      const len = ctx.sampleRate * 4
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      let last = 0
      for (let i = 0; i < len; i++) { const white = Math.random() * 2 - 1; last = (last + 0.02 * white) / 1.02; data[i] = last * 3.2 }
      const src = ctx.createBufferSource()
      src.buffer = buffer
      src.loop = true
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 420
      gain = ctx.createGain()
      gain.gain.value = 0
      src.connect(filter).connect(gain).connect(ctx.destination)
      src.start()
    }
    ctx.resume().catch(() => {})
    gain!.gain.setTargetAtTime(0.035, ctx.currentTime, 1.2)
  } catch { /* no Web Audio — silently nothing */ }
}

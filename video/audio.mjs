// Synthesizes the soundtrack from scratch (no samples): an original 120 BPM track in D minor, plus small sounds on
// the moments the scene reports (window.sceneCues in scene.html). Returns a 16-bit stereo WAV.
const SR = 48000

const mtof = (m) => 440 * 2 ** ((m - 69) / 12)
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x)

// Stable noise, so every render sounds the same
function seeded(seed) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const panGains = (pan) => {
  const a = ((clamp(pan, -1, 1) + 1) * Math.PI) / 4
  return [Math.cos(a), Math.sin(a)]
}

// Zero-delay-feedback state variable filter (Simper)
class SVF {
  constructor(cutoff = 1000, q = 0.707) {
    this.ic1 = 0
    this.ic2 = 0
    this.set(cutoff, q)
  }
  set(cutoff, q) {
    const g = Math.tan((Math.PI * clamp(cutoff, 20, SR * 0.45)) / SR)
    this.k = 1 / q
    this.a1 = 1 / (1 + g * (g + this.k))
    this.a2 = g * this.a1
    this.a3 = g * this.a2
  }
  run(x) {
    const v3 = x - this.ic2
    const v1 = this.a1 * this.ic1 + this.a2 * v3
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3
    this.ic1 = 2 * v1 - this.ic1
    this.ic2 = 2 * v2 - this.ic2
    this.lp = v2
    this.bp = v1
    this.hp = x - this.k * v1 - v2
    return v2
  }
}

const blep = (t, dt) => {
  if (t < dt) {
    t /= dt
    return t + t - t * t - 1
  }
  if (t > 1 - dt) {
    t = (t - 1) / dt
    return t * t + t + t + 1
  }
  return 0
}

class Saw {
  constructor(freq, phase = 0) {
    this.phase = phase
    this.dt = freq / SR
  }
  next() {
    const t = this.phase
    const v = 2 * t - 1 - blep(t, this.dt)
    this.phase += this.dt
    if (this.phase >= 1) this.phase -= 1
    return v
  }
}

// Freeverb: eight combs and four allpasses per side
function reverb([inL, inR], { room = 0.86, damp = 0.25, wet = 1 } = {}) {
  const scale = SR / 44100
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617]
  const passes = [556, 441, 341, 225]
  const side = (input, spread) => {
    const out = new Float32Array(input.length)
    const cs = combs.map((n) => ({ buf: new Float32Array(Math.round((n + spread) * scale)), i: 0, store: 0 }))
    const as = passes.map((n) => ({ buf: new Float32Array(Math.round((n + spread) * scale)), i: 0 }))
    for (let n = 0; n < input.length; n++) {
      const x = input[n] * 0.015
      let y = 0
      for (const c of cs) {
        const o = c.buf[c.i]
        c.store = o * (1 - damp) + c.store * damp
        c.buf[c.i] = x + c.store * room
        if (++c.i >= c.buf.length) c.i = 0
        y += o
      }
      for (const a of as) {
        const b = a.buf[a.i]
        a.buf[a.i] = y + b * 0.5
        if (++a.i >= a.buf.length) a.i = 0
        y = b - y
      }
      out[n] = y * wet
    }
    return out
  }
  return [side(inL, 0), side(inR, 23)]
}

// Ping-pong delay, darker on every repeat
function pingPong([inL, inR], time, feedback) {
  const d = Math.round(time * SR)
  const outL = new Float32Array(inL.length)
  const outR = new Float32Array(inL.length)
  const lpL = new SVF(3200)
  const lpR = new SVF(3200)
  for (let n = 0; n < inL.length; n++) {
    const fromR = n >= d ? outR[n - d] : 0
    const fromL = n >= d ? outL[n - d] : 0
    outL[n] = lpL.run((inL[n] + inR[n]) * 0.5 + fromR * feedback)
    outR[n] = lpR.run(fromL * feedback)
  }
  return [outL, outR]
}

export function renderSoundtrack({ duration, cues, music: musicLevel = 1, sounds: soundsLevel = 1 }) {
  const N = Math.ceil(duration * SR)
  const rand = seeded(7)
  const noise = () => rand() * 2 - 1
  const bus = () => [new Float32Array(N), new Float32Array(N)]
  const tonal = bus() // pad, bass, arp: ducked by the kick
  const drums = bus()
  const sfx = bus()
  const verbSend = bus()
  const delaySend = bus()

  // Renders fn(u) (u: seconds since start) into a bus, with optional sends. pan may be a function of u.
  function voice(target, start, dur, pan, fn, { verb = 0, delay = 0 } = {}) {
    const i0 = Math.round(start * SR)
    const n = Math.round(dur * SR)
    let [gl, gr] = panGains(typeof pan === 'function' ? pan(0) : pan)
    for (let k = 0; k < n; k++) {
      const i = i0 + k
      if (i < 0) continue
      if (i >= N) break
      const u = k / SR
      if (typeof pan === 'function' && k % 64 === 0) [gl, gr] = panGains(pan(u))
      const v = fn(u)
      target[0][i] += v * gl
      target[1][i] += v * gr
      if (verb) {
        verbSend[0][i] += v * gl * verb
        verbSend[1][i] += v * gr * verb
      }
      if (delay) {
        delaySend[0][i] += v * gl * delay
        delaySend[1][i] += v * gr * delay
      }
    }
  }

  // ---------- Music ----------

  // The grid starts 0.2 s in so that bar 10 lands on the logo (18.2 s) and bar 6, the drop, right after ↵ (10.0 s)
  const OFFSET = 0.2
  const BEAT = 0.5
  const at = (bar, beat = 0) => OFFSET + (bar * 4 + beat) * BEAT

  const CHORDS = {
    Dm9: { notes: [50, 57, 60, 64, 65], root: 38 },
    Bb: { notes: [46, 53, 57, 60, 62], root: 34 },
    F: { notes: [53, 57, 60, 64, 67], root: 41 },
    C6: { notes: [48, 55, 57, 60, 64], root: 36 },
    C: { notes: [48, 55, 60, 64, 67], root: 36 },
    F9: { notes: [53, 57, 60, 64, 67, 72], root: 41 },
  }
  // [bar, beat, beats, chord]
  const SCORE = [
    [0, 0, 4, 'Dm9'],
    [1, 0, 4, 'Bb'],
    [2, 0, 4, 'F'],
    [3, 0, 4, 'C6'],
    [4, 0, 2, 'Bb'],
    [4, 2, 2, 'C'],
    [5, 0, 4, 'Dm9'],
    [6, 0, 4, 'Bb'],
    [7, 0, 4, 'F'],
    [8, 0, 2, 'Bb'],
    [8, 2, 2, 'C'],
    [9, 0, 4, 'F9'],
  ]
  const chordAt = (time) => {
    let current = SCORE[0]
    for (const s of SCORE) if (at(s[0], s[1]) <= time + 1e-6) current = s
    return CHORDS[current[3]]
  }
  const END = duration

  // Pad brightness through the piece
  const padCutoff = (time) => {
    const keys = [
      [0, 500],
      [4.2, 1100],
      [10.0, 1100],
      [10.2, 2400],
      [16.2, 2200],
      [18.0, 900],
      [18.2, 2600],
      [20, 900],
    ]
    for (let i = 0; i < keys.length - 1; i++) {
      const [t0, c0] = keys[i]
      const [t1, c1] = keys[i + 1]
      if (time <= t1) return c0 * (c1 / c0) ** clamp((time - t0) / (t1 - t0))
    }
    return keys.at(-1)[1]
  }

  // Pad: three detuned saws per note, slow attack, overlapping releases
  SCORE.forEach(([bar, beat, beats, name], index) => {
    const start = at(bar, beat)
    const last = index === SCORE.length - 1
    const len = last ? END - start : beats * BEAT
    const attack = index === 0 ? 2.2 : 0.18
    const release = 0.5
    CHORDS[name].notes.forEach((note, n) => {
      ;[-0.1, 0, 0.1].forEach((detune, d) => {
        const osc = new Saw(mtof(note + detune), rand())
        const filter = new SVF(800, 0.8)
        const pan = (n / (CHORDS[name].notes.length - 1) - 0.5) * 0.9 + (d - 1) * 0.25
        voice(
          tonal,
          start,
          len + release,
          pan,
          (u) => {
            if ((u * SR) % 32 < 1) filter.set(padCutoff(start + u) * (1 + 0.15 * Math.sin((start + u) * 1.7 + n)), 0.8)
            const env = clamp(u / attack) * (u > len ? Math.exp(-(u - len) / (release / 3)) : 1)
            return filter.run(osc.next()) * env * 0.016
          },
          { verb: 0.45 },
        )
      })
    })
  })

  // Arp: 16th notes an octave above the pad, plucked, through the ping-pong delay
  const ARP = [0, 2, 4, 1, 3, 2, 4, 3]
  for (let step = 0; step < 9 * 16; step++) {
    const time = OFFSET + step * (BEAT / 4)
    const chord = chordAt(time)
    const note = chord.notes[ARP[step % 8] % chord.notes.length] + 12
    const drop = time >= at(5) && time < at(8, 2)
    const typing = time >= at(2) && time < at(5)
    const gain = time < at(1) ? 0.02 * clamp((time - OFFSET) / 2) : drop ? 0.05 : typing ? 0.026 : 0.03
    const base = drop ? 1400 : typing ? 900 : 600
    const accent = step % 4 === 0 ? 1.25 : 1
    const osc = new Saw(mtof(note), 0)
    const filter = new SVF(base, 1.1)
    voice(
      tonal,
      time,
      0.4,
      step % 2 ? 0.35 : -0.35,
      (u) => {
        if ((u * SR) % 16 < 1) filter.set(base + 3200 * Math.exp(-u / 0.045), 1.1)
        const env = clamp(u / 0.002) * Math.exp(-u / 0.11)
        return filter.run(osc.next()) * env * gain * accent
      },
      { verb: 0.2, delay: 0.4 },
    )
  }

  // Bass: long notes while typing, offbeat house bass after the drop
  const bassNote = (time, len, note, gain) => {
    const f = mtof(note)
    const saw = new Saw(f)
    const lp = new SVF(380, 0.9)
    let phase = 0
    voice(tonal, time, len + 0.08, 0, (u) => {
      phase += f / SR
      const env = clamp(u / 0.008) * (u > len ? Math.exp(-(u - len) / 0.025) : 1)
      return Math.tanh((Math.sin(2 * Math.PI * phase) * 0.9 + lp.run(saw.next()) * 0.5) * 1.4) * env * gain
    })
  }
  for (let bar = 2; bar < 5; bar++) {
    for (const half of [0, 2]) bassNote(at(bar, half), BEAT * 2 - 0.05, chordAt(at(bar, half)).root, 0.06)
  }
  for (let bar = 5; bar < 9; bar++) {
    for (let beat = 0; beat < 4; beat++) {
      if (bar === 8 && beat >= 2) continue
      const root = chordAt(at(bar, beat)).root
      bassNote(at(bar, beat + 0.5), 0.2, root + (beat === 3 ? 12 : 0), 0.17)
    }
  }
  bassNote(at(9), 1.5, CHORDS.F9.root, 0.17)

  // Lead: a short FM-bell motif over the drop. [16th step from bar 5, length in 16ths, note]
  const MOTIF = [
    [0, 2, 86], [3, 1, 89], [4, 2, 88], [6, 2, 86], [8, 4, 81], [14, 2, 84],
    [16, 2, 86], [19, 1, 89], [20, 2, 91], [22, 2, 89], [24, 6, 86],
    [32, 2, 84], [35, 1, 88], [36, 2, 89], [38, 2, 88], [40, 4, 84], [44, 2, 81], [46, 2, 84],
    [48, 4, 89], [52, 4, 88], [56, 8, 91],
  ]
  for (const [step, len, note] of MOTIF) {
    const time = at(5) + step * (BEAT / 4)
    const f = mtof(note)
    let pc = 0
    let pm = 0
    voice(
      tonal,
      time,
      len * (BEAT / 4) + 0.7,
      0.1,
      (u) => {
        pc += f / SR
        pm += (2 * f) / SR
        const index = 2.4 * Math.exp(-u / 0.12)
        const env = clamp(u / 0.004) * Math.exp(-u / 0.5)
        return Math.sin(2 * Math.PI * pc + index * Math.sin(2 * Math.PI * pm)) * env * 0.045
      },
      { verb: 0.4, delay: 0.35 },
    )
  }

  // Drums
  const kicks = []
  const kick = (time, gain) => {
    kicks.push({ time, depth: gain > 0.6 ? 0.55 : 0.3 })
    let phase = 0
    voice(drums, time, 0.5, 0, (u) => {
      phase += (45 + 95 * Math.exp(-u / 0.028)) / SR
      const body = Math.sin(2 * Math.PI * phase) * clamp(u / 0.001) * Math.exp(-u / 0.26)
      return Math.tanh((body + noise() * Math.exp(-u / 0.0018) * 0.25) * 1.6) * gain
    })
  }
  const clap = (time, gain) => {
    const bp = new SVF(1300, 0.9)
    voice(
      drums,
      time,
      0.35,
      0.05,
      (u) => {
        const bursts = [0, 0.011, 0.022].reduce((a, o) => a + (u >= o ? Math.exp(-(u - o) / 0.004) : 0), 0)
        const env = bursts * 0.6 + Math.exp(-u / 0.11) * 0.5
        bp.run(noise())
        return bp.bp * env * gain
      },
      { verb: 0.35 },
    )
  }
  const hat = (time, gain, open = false, pan = 0.25) => {
    const hp = new SVF(7500, 0.8)
    voice(drums, time, open ? 0.3 : 0.08, pan, (u) => {
      hp.run(noise())
      return hp.hp * Math.exp(-u / (open ? 0.09 : 0.022)) * gain
    })
  }
  const snare = (time, gain) => {
    const bp = new SVF(1900, 0.8)
    let phase = 0
    voice(
      drums,
      time,
      0.15,
      -0.05,
      (u) => {
        phase += 210 / SR
        bp.run(noise())
        return (bp.bp * 0.9 + Math.sin(2 * Math.PI * phase) * 0.4) * Math.exp(-u / 0.04) * gain
      },
      { verb: 0.25 },
    )
  }
  const crash = (time, gain) => {
    const hp = new SVF(4200, 0.7)
    voice(
      drums,
      time,
      2.2,
      0,
      (u) => {
        hp.run(noise())
        return hp.hp * clamp(u / 0.002) * Math.exp(-u / 0.7) * gain
      },
      { verb: 0.5 },
    )
  }

  for (let bar = 1; bar < 5; bar++) {
    for (let beat = 0; beat < 4; beat++) {
      if (bar >= 2 && beat % 2 === 0) kick(at(bar, beat), 0.28)
      hat(at(bar, beat + 0.5), bar === 1 ? 0.02 : 0.035)
    }
  }
  for (let bar = 5; bar < 9; bar++) {
    for (let beat = 0; beat < 4; beat++) {
      if (bar === 8 && beat >= 2) continue
      kick(at(bar, beat), 0.72)
      if (beat % 2 === 1) clap(at(bar, beat), 0.22)
      hat(at(bar, beat + 0.5), 0.07, beat === 3)
      for (const s of [0.25, 0.75]) hat(at(bar, beat + s), 0.022, false, -0.3)
    }
  }
  // Build into the logo: a snare roll that speeds up
  for (let i = 0; i < 4; i++) snare(at(8, 2 + i * 0.25), 0.05 + i * 0.012)
  for (let i = 0; i < 8; i++) snare(at(8, 3 + i * 0.125), 0.09 + i * 0.012)
  crash(at(5), 0.05)
  kick(at(9), 0.9)
  crash(at(9), 0.06)

  // Riser into the drop
  {
    const start = at(4, 2)
    const len = at(5) - start
    const bp = new SVF(400, 1.4)
    voice(
      tonal,
      start,
      len,
      (u) => Math.sin(u * 9) * 0.4,
      (u) => {
        const p = u / len
        if ((u * SR) % 32 < 1) bp.set(400 * 15 ** p, 1.4)
        bp.run(noise())
        return bp.bp * p ** 2 * 0.12
      },
      { verb: 0.4 },
    )
  }

  // Sidechain: the tonal bus breathes with the kick
  const duck = new Float32Array(N).fill(1)
  for (const { time, depth } of kicks) {
    const i0 = Math.round(time * SR)
    for (let k = 0; k < SR * 0.4 && i0 + k < N; k++) {
      const u = k / SR
      const g = 1 - depth * clamp(u / 0.004) * Math.exp(-u / 0.11)
      if (g < duck[i0 + k]) duck[i0 + k] = g
    }
  }

  // ---------- Small sounds ----------

  const keyClick = (time, { pitch = 1, gain = 0.2, pan = 0, body = 180 } = {}) => {
    const bp = new SVF(4200 * pitch, 1.4)
    let phase = 0
    voice(
      sfx,
      time,
      0.04,
      pan,
      (u) => {
        phase += (body * pitch) / SR
        bp.run(noise())
        return (bp.bp * 1.4 * Math.exp(-u / 0.0035) + Math.sin(2 * Math.PI * phase) * 0.5 * Math.exp(-u / 0.014)) * gain
      },
      { verb: 0.08 },
    )
    // The key coming back up
    const release = time + 0.055 + rand() * 0.03
    const bp2 = new SVF(5200 * pitch, 1.6)
    voice(sfx, release, 0.015, pan, (u) => {
      bp2.run(noise())
      return bp2.bp * Math.exp(-u / 0.0018) * gain * 0.35
    })
  }

  const bloop = (time, f0, f1, gain, pan) => {
    let phase = 0
    voice(
      sfx,
      time,
      0.16,
      pan,
      (u) => {
        phase += (f0 + (f1 - f0) * (1 - Math.exp(-u / 0.018))) / SR
        return Math.sin(2 * Math.PI * phase) * clamp(u / 0.002) * Math.exp(-u / 0.045) * gain
      },
      { verb: 0.25 },
    )
  }

  // Soft bell: a few inharmonic partials
  const chime = (time, f, gain, pan = 0, decay = 0.45) => {
    const partials = [
      [1, 1, 1],
      [2.76, 0.25, 0.35],
      [5.4, 0.08, 0.2],
    ]
    const phases = partials.map(() => 0)
    voice(
      sfx,
      time,
      decay * 5,
      pan,
      (u) => {
        let v = 0
        partials.forEach(([ratio, amp, d], i) => {
          phases[i] += (f * ratio) / SR
          v += Math.sin(2 * Math.PI * phases[i]) * amp * Math.exp(-u / (decay * d))
        })
        return v * clamp(u / 0.003) * gain
      },
      { verb: 0.45 },
    )
  }

  const thump = (time, f, decay, gain) => {
    let phase = 0
    voice(sfx, time, decay * 5, 0, (u) => {
      phase += (f * (1 + 0.8 * Math.exp(-u / 0.03))) / SR
      return Math.tanh(Math.sin(2 * Math.PI * phase) * 1.3) * clamp(u / 0.002) * Math.exp(-u / decay) * gain
    })
  }

  const whoosh = (time, dur, f0, f1, gain, pan0 = 0, pan1 = 0, shape = 0.5) => {
    const bp = new SVF(f0, 1.1)
    voice(
      sfx,
      time,
      dur,
      (u) => pan0 + (pan1 - pan0) * (u / dur),
      (u) => {
        const p = u / dur
        if ((u * SR) % 32 < 1) bp.set(f0 * (f1 / f0) ** p, 1.1)
        bp.run(noise())
        // Peak at `shape` along the way
        const env = p < shape ? Math.sin((p / shape) * (Math.PI / 2)) : Math.cos(((p - shape) / (1 - shape)) * (Math.PI / 2))
        return bp.bp * env ** 2 * gain
      },
      { verb: 0.3 },
    )
  }

  const PENTATONIC = [74, 77, 79, 81, 84, 86, 89, 91, 93]

  const SOUNDS = {
    // Lucía's message arrives, on the left
    message: (c) => {
      bloop(c.time, 620, 1240, 0.13, -0.45)
      bloop(c.time + 0.1, 900, 1700, 0.1, -0.45)
    },
    word: (c) => whoosh(c.time - 0.05, 0.25, 900, 2400, 0.035, 0.2, 0.3, 0.4),
    slam: (c) => {
      whoosh(c.time - 0.45, 0.55, 300, 3200, 0.07, 0.5, 0.15, 0.85)
      thump(c.time + 0.04, 62, 0.22, 0.3)
    },
    wordsOut: (c) => whoosh(c.time, 0.8, 3000, 500, 0.06, 0.1, 0.4, 0.3),
    rise: (c) => whoosh(c.time, 0.9, 220, 1800, 0.05, 0, 0, 0.7),
    // ⌘ ⌘: two key presses, each with a note, the second one higher
    cmd: (c) => {
      keyClick(c.time, { pitch: 0.7, gain: 0.42, body: 140 })
      chime(c.time + 0.01, c.n === 1 ? mtof(81) : mtof(88), 0.06, 0, 0.5)
    },
    // The key grows into the launcher, then settles
    morph: (c) => {
      whoosh(c.time, 1.0, 500, 3800, 0.045, -0.25, 0.25, 0.6)
      thump(c.time + 0.95, 95, 0.08, 0.14)
    },
    pop: (c) => bloop(c.time, 380, 820, 0.07, 0),
    type: (c) => {
      const space = c.char === ' '
      keyClick(c.time, {
        pitch: space ? 0.72 : 0.9 + rand() * 0.28,
        gain: (space ? 0.2 : 0.13) + rand() * 0.05,
        pan: -0.2 + rand() * 0.4,
      })
    },
    note: (c) => {
      chime(c.time, mtof(96), 0.025, 0.15, 0.25)
      chime(c.time + 0.06, mtof(100), 0.02, 0.15, 0.25)
    },
    keyIn: (c) => bloop(c.time, 300, 620, 0.05, 0.5),
    enter: (c) => {
      keyClick(c.time, { pitch: 0.55, gain: 0.5, body: 110, pan: 0.35 })
      thump(c.time, 85, 0.07, 0.16)
    },
    // Thinking: faint data blips
    think: (c) => {
      for (let i = 0; i < 10; i++) {
        const t = c.time + 0.05 + i * 0.09 + rand() * 0.03
        chime(t, mtof(PENTATONIC[Math.floor(rand() * PENTATONIC.length)] + 12), 0.012, -0.5 + rand(), 0.06)
      }
    },
    // Answers flip in: three notes going up
    row: (c) => chime(c.time, mtof([86, 89, 93][c.n]), 0.09, -0.2 + c.n * 0.2, 0.3),
    // Listen: soft pings with the speaker's waves
    listen: (c) => {
      for (let i = 0; i < 3; i++) chime(c.time + i * c.step, mtof(88), [0.08, 0.055, 0.035][i], -0.3, 0.35)
    },
    copied: (c) => {
      chime(c.time, mtof(91), 0.08, 0, 0.25)
      chime(c.time + 0.07, mtof(96), 0.07, 0, 0.35)
    },
    // The answer flies from the launcher to the chat, on the left
    fly: (c) => whoosh(c.time, c.dur, 450, 2600, 0.12, 0.3, -0.5, 0.45),
    sent: (c) => {
      bloop(c.time, 700, 1400, 0.16, -0.45)
      chime(c.time + 0.05, mtof(93), 0.05, -0.45, 0.3)
    },
    // The bubbles turn into the icon: a swell that cuts on the logo
    morphOut: (c) => {
      const len = c.until - c.time
      const hp = new SVF(300, 0.9)
      voice(
        sfx,
        c.time,
        len,
        0,
        (u) => {
          const p = u / len
          if ((u * SR) % 32 < 1) hp.set(300 * 20 ** p, 0.9)
          hp.run(noise())
          return hp.bp * p ** 2.5 * 0.1
        },
        { verb: 0.5 },
      )
    },
    logo: (c) => {
      thump(c.time, 48, 0.55, 0.5)
      const lp = new SVF(1800, 0.7)
      voice(
        sfx,
        c.time,
        0.8,
        0,
        (u) => {
          lp.run(noise())
          return lp.lp * Math.exp(-u / 0.12) * 0.18
        },
        { verb: 0.6 },
      )
      ;[77, 81, 84, 88, 91].forEach((n, i) => chime(c.time + i * 0.012, mtof(n), 0.03, -0.4 + i * 0.2, 1.1))
    },
    // The name builds letter by letter: a soft flourish of ticks
    letters: (c) => {
      for (let i = 0; i < c.count; i++) {
        keyClick(c.time + i * c.step, { pitch: 1.3 + i * 0.03, gain: 0.04, pan: -0.5 + i / c.count })
      }
    },
  }

  for (const cue of cues) {
    const sound = SOUNDS[cue.name]
    if (!sound) throw new Error(`No sound for cue "${cue.name}"`)
    sound(cue)
  }

  // ---------- Mix ----------

  const verb = reverb(verbSend)
  const echo = pingPong(delaySend, BEAT * 0.75, 0.38) // dotted 8th
  // The music steps back a little (up to ~4 dB) while a small sound plays
  const backOff = new Float32Array(N)
  let follow = 0
  for (let i = 0; i < N; i++) {
    const level = Math.abs(sfx[0][i]) + Math.abs(sfx[1][i])
    follow = level > follow ? follow + (level - follow) * 0.01 : follow * 0.99985
    backOff[i] = 1 - 0.38 * clamp(follow * 6)
  }
  const out = [new Float32Array(N), new Float32Array(N)]
  const fadeStart = duration - 0.8
  for (let ch = 0; ch < 2; ch++) {
    for (let i = 0; i < N; i++) {
      const time = i / SR
      const fade = time > fadeStart ? Math.cos(((time - fadeStart) / 0.8) * (Math.PI / 2)) ** 2 : 1
      const music = (tonal[ch][i] * duck[i] * 0.9 + drums[ch][i] * 0.75 + echo[ch][i] * 0.5) * backOff[i]
      out[ch][i] = (music * 0.85 * musicLevel + sfx[ch][i] * 1.1 * soundsLevel + verb[ch][i] * 0.9) * fade
    }
  }

  // Fixed master gain into a gentle peak limiter: peaks stay under -2 dBFS
  const MASTER = 2.1
  let gain = 1
  for (let i = 0; i < N; i++) {
    const level = Math.max(Math.abs(out[0][i]), Math.abs(out[1][i])) * MASTER
    const target = level > 0.9 ? 0.9 / level : 1
    gain = target < gain ? target : gain + (target - gain) * 0.0004
    out[0][i] = Math.tanh(out[0][i] * MASTER * gain)
    out[1][i] = Math.tanh(out[1][i] * MASTER * gain)
  }

  const wav = Buffer.alloc(44 + N * 4)
  wav.write('RIFF', 0)
  wav.writeUInt32LE(36 + N * 4, 4)
  wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20) // PCM
  wav.writeUInt16LE(2, 22)
  wav.writeUInt32LE(SR, 24)
  wav.writeUInt32LE(SR * 4, 28)
  wav.writeUInt16LE(4, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(N * 4, 40)
  for (let i = 0; i < N; i++) {
    wav.writeInt16LE(Math.round(clamp(out[0][i], -1, 1) * 32767), 44 + i * 4)
    wav.writeInt16LE(Math.round(clamp(out[1][i], -1, 1) * 32767), 46 + i * 4)
  }
  return wav
}

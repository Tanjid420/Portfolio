import { useEffect } from 'react'
import { useSoundSettings } from '../soundSettings'
import { BUGS, type BugKind } from './bugs'
import { useGame } from './store'

// Every sound is made with the Web Audio API, so there are no audio files to download.
// Browsers only allow audio after a click or key press, so nothing plays before the first one.

const MASTER_VOLUME = 0.6
const MUSIC_VOLUME = 0.35
const SFX_VOLUME = 0.8

let ctx: AudioContext | null = null
let sfxOut: GainNode
let musicOut: GainNode
let noise: AudioBuffer
/** True while the game screen is open. Sound stops on the CV page. */
let active = false

const freq = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

function setup() {
  if (ctx) return ctx
  const AC =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  const master = ctx.createGain()
  master.gain.value = MASTER_VOLUME
  master.connect(ctx.destination)
  sfxOut = ctx.createGain()
  sfxOut.gain.value = SFX_VOLUME
  sfxOut.connect(master)
  musicOut = ctx.createGain()
  musicOut.gain.value = MUSIC_VOLUME
  musicOut.connect(master)
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return ctx
}

/** Runs the audio only when it should be heard. Suspending also stops the music and saves battery. */
function applyState() {
  if (!ctx) return
  const run = active && !useSoundSettings.getState().muted && !document.hidden
  if (run && ctx.state === 'suspended') void ctx.resume()
  if (!run && ctx.state === 'running') void ctx.suspend()
}

/** Audio is running and audible. Sound effects check this so they don't pile up while muted. */
const audible = () => ctx?.state === 'running'

interface ToneOptions {
  type?: OscillatorType
  vol?: number
  /** Pitch at the end of the note, for slides. */
  slideTo?: number
  attack?: number
  out?: AudioNode
}

function tone(hz: number, at: number, dur: number, o: ToneOptions = {}) {
  const c = ctx!
  const osc = c.createOscillator()
  const env = c.createGain()
  osc.type = o.type ?? 'triangle'
  osc.frequency.setValueAtTime(hz, at)
  if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, at + dur)
  env.gain.setValueAtTime(0, at)
  env.gain.linearRampToValueAtTime(o.vol ?? 0.3, at + (o.attack ?? 0.01))
  env.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  osc.connect(env).connect(o.out ?? sfxOut)
  osc.start(at)
  osc.stop(at + dur + 0.02)
}

/** Filtered noise. With a moving filter it sounds like a whoosh, short and high it is a shaker. */
function hiss(at: number, dur: number, from: number, to: number, vol: number, out: AudioNode = sfxOut) {
  const c = ctx!
  const src = c.createBufferSource()
  src.buffer = noise
  const filter = c.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = 1.2
  filter.frequency.setValueAtTime(from, at)
  filter.frequency.exponentialRampToValueAtTime(to, at + dur)
  const env = c.createGain()
  env.gain.setValueAtTime(0, at)
  env.gain.linearRampToValueAtTime(vol, at + dur * 0.3)
  env.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  src.connect(filter).connect(env).connect(out)
  src.start(at, Math.random() * 0.5)
  src.stop(at + dur + 0.02)
}

interface VoiceOptions {
  /** Pitch over time, as [fraction of the duration, Hz]. */
  pitch: [number, number][]
  /** Vowel shape: each formant filter's centre frequency from start to end, in Hz. */
  formants: [number, number][]
  /** Wobble speed (Hz) and how deep it gets, from start to end (Hz). */
  vibrato: number
  vibratoDepth: [number, number]
  /** Optional fast volume flutter, [speed in Hz, depth 0..1]: makes an "a-a-a-ah" warble. */
  tremolo?: [number, number]
  vol: number
}

/**
 * A cartoon voice: a buzzy tone shaped by vowel filters, with a wobble in the pitch.
 * Moving the filters changes the vowel, e.g. "ah" into "oo".
 */
function voice(at: number, dur: number, o: VoiceOptions) {
  const c = ctx!
  const osc = c.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(o.pitch[0][1], at)
  for (const [f, hz] of o.pitch.slice(1)) osc.frequency.linearRampToValueAtTime(hz, at + f * dur)

  const lfo = c.createOscillator()
  lfo.frequency.value = o.vibrato
  const depth = c.createGain()
  depth.gain.setValueAtTime(o.vibratoDepth[0], at)
  depth.gain.linearRampToValueAtTime(o.vibratoDepth[1], at + dur)
  lfo.connect(depth).connect(osc.frequency)

  const env = c.createGain()
  env.gain.setValueAtTime(0, at)
  env.gain.linearRampToValueAtTime(o.vol, at + 0.03)
  env.gain.setValueAtTime(o.vol, at + dur * 0.7)
  env.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  let out: AudioNode = env
  if (o.tremolo) {
    const [rate, amount] = o.tremolo
    const flutter = c.createGain()
    flutter.gain.value = 1 - amount / 2
    const trem = c.createOscillator()
    trem.frequency.value = rate
    const tremDepth = c.createGain()
    tremDepth.gain.value = amount / 2
    trem.connect(tremDepth).connect(flutter.gain)
    env.connect(flutter)
    out = flutter
    trem.start(at)
    trem.stop(at + dur + 0.05)
  }
  out.connect(sfxOut)

  for (const [from, to] of o.formants) {
    const f = c.createBiquadFilter()
    f.type = 'bandpass'
    f.Q.value = 6
    f.frequency.setValueAtTime(from, at)
    f.frequency.linearRampToValueAtTime(to, at + dur)
    osc.connect(f).connect(env)
  }
  // A little of the raw tone keeps it bright.
  const dry = c.createGain()
  dry.gain.value = 0.12
  osc.connect(dry).connect(env)

  osc.start(at)
  lfo.start(at)
  osc.stop(at + dur + 0.05)
  lfo.stop(at + dur + 0.05)
}

/** Small bugs: a panicked "ip-ip-ip!", a warbly "EEEE-ooww!", and a little "boing". A bit different every time. */
function squeak(at: number) {
  const k = 0.85 + Math.random() * 0.3
  ;[0, 0.075, 0.15].forEach((d, i) =>
    voice(at + d, 0.06, {
      pitch: [
        [0, (1100 + i * 150) * k],
        [1, (1500 + i * 180) * k],
      ],
      formants: [[2500, 2700]],
      vibrato: 1,
      vibratoDepth: [0, 0],
      vol: 0.22,
    }),
  )
  voice(at + 0.24, 0.55, {
    pitch: [
      [0, 1300 * k],
      [0.25, 2000 * k],
      [0.7, 1650 * k],
      [1, 480 * k],
    ],
    // "ee" sliding into "ow".
    formants: [
      [2600, 900],
      [3400, 1300],
    ],
    vibrato: 14,
    vibratoDepth: [30, 120],
    tremolo: [24, 0.8],
    vol: 0.25,
  })
  tone(760 * k, at + 0.8, 0.28, { type: 'sine', slideTo: 260 * k, vol: 0.09 })
  tone(1520 * k, at + 0.8, 0.12, { type: 'sine', slideTo: 520 * k, vol: 0.03 })
}

/** Sad trombone: "wah-wah-wah-waaaah". Each note opens from "w" to "ah"; the last one sags and wobbles. */
function sadTrombone(at: number) {
  const notes: [number, number][] = [
    [62, 0.32],
    [61, 0.32],
    [60, 0.32],
    [59, 1.1],
  ]
  let t = at
  notes.forEach(([m, dur], i) => {
    const last = i === notes.length - 1
    voice(t, dur, {
      pitch: [
        [0, freq(m) * 0.97],
        [0.15, freq(m)],
        [1, freq(m) * (last ? 0.94 : 0.99)],
      ],
      formants: [
        [380, last ? 600 : 1100],
        [800, last ? 1100 : 1500],
      ],
      vibrato: 6,
      vibratoDepth: last ? [2, 18] : [1, 3],
      vol: 0.3,
    })
    t += dur + 0.02
  })
}

/** Plays a sound effect now, if sound is on. */
function play(fn: (now: number) => void) {
  if (audible()) fn(ctx!.currentTime)
}

export const sfx = {
  swing: () => play((t) => hiss(t, 0.2, 500, 2200, 0.35)),
  catch: (kind: BugKind) =>
    play((t) => {
      if (kind === 'golden') {
        // Squeak, then a rising sparkle arpeggio, the "big catch" moment.
        squeak(t)
        ;[72, 76, 79, 84, 88].forEach((m, i) => tone(freq(m), t + 1.0 + i * 0.06, 0.35, { vol: 0.16 }))
        ;[96, 100, 103].forEach((m, i) => tone(freq(m), t + 1.3 + i * 0.05, 0.4, { type: 'sine', vol: 0.07 }))
      } else if (kind === 'boss') {
        // Heavy thud, then a sad trombone: "wah-wah-wah-waaaah".
        tone(140, t, 0.35, { type: 'sawtooth', slideTo: 50, vol: 0.2 })
        sadTrombone(t + 0.3)
      } else {
        // Squeak, then a cute "bloop".
        squeak(t)
        tone(freq(84), t + 1.05, 0.18, { vol: 0.12 })
      }
    }),
  hidden: () =>
    play((t) => {
      squeak(t)
      ;[88, 91, 96, 91, 100].forEach((m, i) => tone(freq(m), t + 1.0 + i * 0.05, 0.3, { type: 'sine', vol: 0.08 }))
    }),
  pickup: () =>
    play((t) => {
      tone(freq(79), t, 0.2, { type: 'sine', vol: 0.25 })
      tone(freq(86), t + 0.12, 0.35, { type: 'sine', vol: 0.25 })
    }),
  // "All tests passed": a little fanfare.
  finale: () =>
    play((t) => {
      ;[67, 72, 76, 79].forEach((m, i) => tone(freq(m), t + i * 0.12, 0.3, { vol: 0.2 }))
      ;[72, 76, 79, 84].forEach((m) => tone(freq(m), t + 0.5, 1.2, { vol: 0.12, attack: 0.04 }))
      ;[96, 100, 103, 108].forEach((m, i) => tone(freq(m), t + 0.55 + i * 0.07, 0.5, { type: 'sine', vol: 0.06 }))
    }),
  card: () =>
    play((t) => {
      hiss(t, 0.12, 3000, 1500, 0.12)
      tone(freq(81), t + 0.02, 0.15, { type: 'sine', vol: 0.15 })
      tone(freq(88), t + 0.08, 0.2, { type: 'sine', vol: 0.12 })
    }),
}

// Background music: a gentle 4-bar loop (C, Am, F, G) with a plucked arpeggio, bass and a soft shaker.
const STEP = 60 / 100 / 2 // eighth notes at 100 bpm
const CHORDS = [
  [72, 76, 79, 84],
  [69, 72, 76, 81],
  [65, 69, 72, 77],
  [67, 71, 74, 79],
]
const ARP_A = [0, 2, 1, 2, 3, 2, 1, -1]
const ARP_B = [3, -1, 2, 1, 0, -1, 1, 2]
let step = 0
let nextAt = 0
let timer: ReturnType<typeof setInterval> | undefined

function scheduleMusic() {
  // While the audio is suspended its clock stands still, so this schedules nothing.
  while (ctx && nextAt < ctx.currentTime + 0.2) {
    const bar = Math.floor(step / 8) % 4
    const beat = step % 8
    const chord = CHORDS[bar]
    const arp = Math.floor(step / 32) % 2 ? ARP_B : ARP_A
    if (arp[beat] >= 0) tone(freq(chord[arp[beat]]), nextAt, 0.4, { vol: 0.07, out: musicOut })
    if (beat === 0 || beat === 4) tone(freq(chord[0] - 24), nextAt, 0.55, { vol: 0.16, out: musicOut })
    if (beat === 6) tone(freq(chord[2] - 24), nextAt, 0.3, { vol: 0.12, out: musicOut })
    if (beat % 2) hiss(nextAt, 0.05, 7000, 6000, 0.025, musicOut)
    nextAt += STEP
    step++
  }
}

function startMusic() {
  if (!ctx || timer) return
  nextAt = ctx.currentTime + 0.1
  timer = setInterval(scheduleMusic, 50)
}

function stopMusic() {
  clearInterval(timer)
  timer = undefined
}

/** Turns on the music and sound effects while the game screen is open. */
export function useGameAudio() {
  useEffect(() => {
    active = true
    applyState()
    if (ctx) startMusic()

    // The first click, tap or key press unlocks audio. Sound is on by default.
    // Phones only count the end of a tap as a click, so listen for that too.
    const unlock = () => {
      if (!setup()) return
      applyState()
      startMusic()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyM' && !e.repeat && !(e.target instanceof HTMLInputElement)) {
        useSoundSettings.getState().toggleMuted()
      }
      unlock()
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('pointerup', unlock)
    window.addEventListener('touchend', unlock)
    window.addEventListener('keydown', onKey)
    document.addEventListener('visibilitychange', applyState)
    const offSettings = useSoundSettings.subscribe(applyState)

    const offGame = useGame.subscribe((s, prev) => {
      if (s.swingStartedAt !== prev.swingStartedAt && Number.isFinite(s.swingStartedAt)) sfx.swing()
      if (s.caught.length > prev.caught.length) {
        const def = BUGS.find((b) => b.id === s.caught[s.caught.length - 1])
        sfx.catch(def?.kind ?? 'normal')
      }
      if (s.found.length > prev.found.length) sfx.hidden()
      if (s.hasGlass && !prev.hasGlass) sfx.pickup()
    })

    return () => {
      active = false
      stopMusic()
      applyState()
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('pointerup', unlock)
      window.removeEventListener('touchend', unlock)
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('visibilitychange', applyState)
      offSettings()
      offGame()
    }
  }, [])
}

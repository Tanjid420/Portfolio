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

/** Plays a sound effect now, if sound is on. */
function play(fn: (now: number) => void) {
  if (audible()) fn(ctx!.currentTime)
}

export const sfx = {
  swing: () => play((t) => hiss(t, 0.2, 500, 2200, 0.35)),
  catch: (kind: BugKind) =>
    play((t) => {
      if (kind === 'golden') {
        // Rising sparkle arpeggio, the "big catch" moment.
        ;[72, 76, 79, 84, 88].forEach((m, i) => tone(freq(m), t + i * 0.06, 0.35, { vol: 0.22 }))
        ;[96, 100, 103].forEach((m, i) => tone(freq(m), t + 0.3 + i * 0.05, 0.4, { type: 'sine', vol: 0.08 }))
      } else if (kind === 'boss') {
        // Heavy thud, then a little victory chord.
        tone(140, t, 0.35, { type: 'sawtooth', slideTo: 50, vol: 0.25 })
        ;[60, 64, 67, 72].forEach((m) => tone(freq(m), t + 0.25, 0.6, { vol: 0.12, attack: 0.03 }))
      } else {
        // Cute "bloop".
        tone(520, t, 0.1, { type: 'square', slideTo: 900, vol: 0.12 })
        tone(freq(84), t + 0.09, 0.18, { vol: 0.2 })
      }
    }),
  hidden: () =>
    play((t) => [88, 91, 96, 91, 100].forEach((m, i) => tone(freq(m), t + i * 0.05, 0.3, { type: 'sine', vol: 0.1 }))),
  pickup: () =>
    play((t) => {
      tone(freq(79), t, 0.2, { type: 'sine', vol: 0.25 })
      tone(freq(86), t + 0.12, 0.35, { type: 'sine', vol: 0.25 })
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

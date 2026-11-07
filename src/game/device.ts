// What the device can handle. Testers can force a mode with ?quality=low|high and ?touch=1|0.
const params = new URLSearchParams(window.location.search)

/** True on phones and tablets: shows the joystick and net button. */
export const isTouch =
  params.get('touch') === '1' || (params.get('touch') !== '0' && window.matchMedia('(pointer: coarse)').matches)

export type Quality = 'high' | 'low'

/** Phones and weak machines get lighter graphics. */
export const quality: Quality = (() => {
  const forced = params.get('quality')
  if (forced === 'low' || forced === 'high') return forced
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8
  const cores = navigator.hardwareConcurrency ?? 8
  return isTouch || memory <= 4 || cores <= 4 ? 'low' : 'high'
})()

/** Checks that the browser can draw 3D before the game bundle loads. */
export function hasWebGL(): boolean {
  if (params.get('webgl') === '0') return false
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    // Free the test context right away; browsers only allow a few at once.
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return !!gl
  } catch {
    return false
  }
}

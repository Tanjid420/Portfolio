import { useRef, type PointerEvent } from 'react'
import { touch } from './input'

/** How far the knob can travel from the center, in pixels. */
const REACH = 46
/** Small pushes are ignored so the hero doesn't drift. */
const DEAD_ZONE = 0.15

// Joystick (bottom left) and net button (bottom right). Only shown on touch screens.
export function TouchControls() {
  const base = useRef<HTMLDivElement>(null)
  const knob = useRef<HTMLDivElement>(null)
  const pointerId = useRef<number | null>(null)

  const steer = (e: PointerEvent) => {
    const r = base.current!.getBoundingClientRect()
    let x = e.clientX - (r.left + r.width / 2)
    let y = e.clientY - (r.top + r.height / 2)
    const d = Math.hypot(x, y)
    if (d > REACH) {
      x *= REACH / d
      y *= REACH / d
    }
    knob.current!.style.transform = `translate(${x}px, ${y}px)`
    const strong = Math.hypot(x, y) / REACH > DEAD_ZONE
    // Screen down is +z in the world, so y maps straight to z.
    touch.x = strong ? x / REACH : 0
    touch.z = strong ? y / REACH : 0
  }

  const release = (e: PointerEvent) => {
    if (e.pointerId !== pointerId.current) return
    pointerId.current = null
    touch.x = 0
    touch.z = 0
    knob.current!.style.transform = ''
  }

  return (
    <div className="touch-controls" data-testid="touch-controls">
      <div
        ref={base}
        className="touch-stick"
        role="presentation"
        data-testid="joystick"
        onPointerDown={(e) => {
          if (pointerId.current !== null) return
          pointerId.current = e.pointerId
          e.currentTarget.setPointerCapture(e.pointerId)
          steer(e)
        }}
        onPointerMove={(e) => {
          if (e.pointerId === pointerId.current) steer(e)
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
      >
        <div ref={knob} className="touch-knob" />
      </div>
      <button
        type="button"
        className="touch-net"
        aria-label="Swing the net"
        data-testid="net-button"
        onPointerDown={(e) => {
          e.preventDefault()
          touch.swing = true
        }}
      >
        Swing
      </button>
    </div>
  )
}

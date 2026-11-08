import { useEffect, useRef } from 'react'
import { BUGS } from '../game/bugs'
import { isTouch } from '../game/device'
import { HIDDEN_BUGS } from '../game/hidden'
import { useHelp } from '../helpState'
import { TestThisSite } from './TestThisSite'

/** The rules in short, bold bullet points. Used on the start screen and in the "How to play" panel. */
export function HowToPlayList() {
  return (
    <ul className="how-to-play" data-testid="how-to-play">
      <li>
        <span aria-hidden="true">🕹️</span>
        <span>
          <em>Walk:</em> {isTouch ? 'use the joystick' : 'WASD or the arrow keys'}
        </span>
      </li>
      <li>
        <span aria-hidden="true">🥅</span>
        <span>
          <em>Catch:</em> get close to a bug and {isTouch ? 'tap the Swing button' : 'press Space'} to swing the net
        </span>
      </li>
      <li>
        <span aria-hidden="true">🐞</span>
        <span>
          <em>{BUGS.length} bugs</em> are loose. Each one carries a part of the CV. Catch them all for 100% coverage.
        </span>
      </li>
      <li>
        <span aria-hidden="true">🔍</span>
        <span>
          <em>{HIDDEN_BUGS.length} hidden bugs</em> hold fun facts. Pick up the <em>magnifying glass</em> at the
          starting point to see and catch them.
        </span>
      </li>
      <li>
        <span aria-hidden="true">📌</span>
        <span>
          <em>Notice board:</em> {isTouch ? 'tap the bubble' : 'press E'} next to it to read About Me again.
        </span>
      </li>
      {!isTouch && (
        <li>
          <span aria-hidden="true">🔊</span>
          <span>
            <em>M</em> mutes the sound.
          </span>
        </li>
      )}
    </ul>
  )
}

/** Panel opened from the top bar's "How to play" button. Escape, the button or a click outside closes it. */
export function HowToPlayPanel() {
  const open = useHelp((s) => s.open)
  const setOpen = useHelp((s) => s.setOpen)
  const button = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    button.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  if (!open) return null
  return (
    <div className="help-backdrop" onClick={() => setOpen(false)} data-testid="help-panel">
      <section
        className="screen"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="screen-kicker">🐞 Bug Hunt</p>
        <h2 id="help-title" className="screen-title">
          How to play
        </h2>
        <HowToPlayList />
        <TestThisSite />
        <div className="screen-actions">
          <button
            ref={button}
            type="button"
            className="btn btn-primary btn-big"
            onClick={(e) => {
              e.currentTarget.blur()
              setOpen(false)
            }}
            data-testid="help-close"
          >
            Got it
          </button>
        </div>
      </section>
    </div>
  )
}

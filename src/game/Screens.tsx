import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ContactList } from '../components/ContactList'
import { TestThisSite } from '../components/TestThisSite'
import { HowToPlayList } from '../components/HowToPlay'
import { cv, cvPdfUrl } from '../data/cv'
import { BUGS } from './bugs'
import { isTouch } from './device'
import { HIDDEN_BUGS } from './hidden'
import { sfx } from './sound'
import { allDone, isPaused, showingEnd, useGame } from './store'
import { NOTICE_BOARD } from './world'

/** Screens ignore closing for a moment after opening, so a held or mashed key doesn't skip them. */
const READY_AFTER_MS = 500
/** Within this distance of the notice board, a "Press E" prompt shows. */
const BOARD_READ_DISTANCE = 3

/**
 * Focuses the main button once the screen is ready. `isReady()` reads a ref, so key listeners
 * never see a stale value while React is still catching up.
 */
function useReadyButton(open: boolean) {
  const button = useRef<HTMLButtonElement>(null)
  const readyRef = useRef(false)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    readyRef.current = false
    setReady(false)
    if (!open) return
    const t = setTimeout(() => {
      readyRef.current = true
      setReady(true)
      button.current?.focus()
    }, READY_AFTER_MS)
    return () => clearTimeout(t)
  }, [open])
  return { button, ready, isReady: () => readyRef.current }
}

// "Catch the bugs, read the reports." Pressing Start also turns on the sound.
export function StartScreen() {
  const started = useGame((s) => s.started)
  const start = useGame((s) => s.start)
  if (started) return null
  return (
    <div className="screen-backdrop screen-start" data-testid="start-screen">
      <section className="screen" role="dialog" aria-modal="true" aria-labelledby="start-title">
        <p className="screen-kicker">🐞 Bug Hunt</p>
        <h1 id="start-title" className="screen-title">
          Catch the bugs, read the reports.
        </h1>
        <p className="screen-text">
          {BUGS.length} bugs escaped onto {cv.shortName.split(' ')[0]}'s island. About 2 minutes. No bugs are harmed.
        </p>
        <HowToPlayList />
        <div className="screen-actions">
          <button className="btn btn-primary btn-big" onClick={start} autoFocus data-testid="start">
            Start Hunting ▶
          </button>
          <a className="btn btn-ghost" href="#/cv">
            In a hurry? Read the CV
          </a>
        </div>
      </section>
    </div>
  )
}

/** The hero stands next to the notice board and nothing else is open. */
export const canReadBoard = (s: ReturnType<typeof useGame.getState>) =>
  !isPaused(s) && Math.hypot(s.focus[0] - NOTICE_BOARD[0], s.focus[1] - NOTICE_BOARD[1]) < BOARD_READ_DISTANCE

// Notice board in the Welcome Zone: summary and contact. Opens after Start, and with E (or a tap) next to the board.
export function WelcomeBoard() {
  const open = useGame((s) => s.boardOpen)
  const firstVisit = useGame((s) => s.caught.length === 0)
  const { button, ready, isReady } = useReadyButton(open)

  // E next to the board opens it. Walking past it never does, so it can't pop up by accident.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyE' || e.repeat) return
      const s = useGame.getState()
      if (canReadBoard(s)) s.setBoardOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) sfx.card()
  }, [open])

  const close = () => {
    if (isReady()) useGame.getState().setBoardOpen(false)
  }
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.code === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // close() only reads refs and the store, so it never goes stale.
  }, [open])

  if (!open) return null
  return (
    <div className="report-backdrop" onClick={close} data-testid="welcome-board-backdrop">
      <article
        className="report report-board"
        role="dialog"
        aria-modal="true"
        aria-labelledby="board-title"
        onClick={(e) => e.stopPropagation()}
        data-testid="welcome-board"
      >
        <header className="report-head">
          <span className="report-id">README.md</span>
          <span className="pill pill-info">📌 About Me (Welcome Zone)</span>
        </header>
        <h2 id="board-title" className="report-title">
          Hi, I'm {cv.shortName} 👋
          <span className="board-role">{cv.title}</span>
        </h2>
        <div className="board-summary">
          {cv.summary.map((p) => (
            <p key={p.slice(0, 20)}>{p}</p>
          ))}
        </div>
        <ContactList className="board-contact" />
        <footer className="report-foot">
          <span className="muted">{isTouch ? 'Tap' : 'Press E'} at the notice board to read this again.</span>
          <button
            ref={button}
            className="btn btn-primary"
            onClick={close}
            aria-disabled={!ready}
            data-testid="welcome-board-close"
          >
            {firstVisit ? "Let's catch some bugs" : 'Back to the hunt'}
          </button>
        </footer>
      </article>
    </div>
  )
}

const CONFETTI_COLORS = ['#5DBB8C', '#F2C14E', '#FF7452', '#E4EDE6', '#2A8C9E', '#B794FF']

function Confetti() {
  // Random once per showing, so pieces don't jump around on re-render.
  const pieces = useMemo(
    () =>
      Array.from({ length: 80 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.9,
        duration: 2.4 + Math.random() * 1.8,
        drift: (Math.random() - 0.5) * 160,
        spin: 360 + Math.random() * 720,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        wide: Math.random() < 0.5,
      })),
    [],
  )
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          style={
            {
              left: `${p.left}%`,
              background: p.color,
              width: p.wide ? 10 : 6,
              height: p.wide ? 6 : 12,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              '--drift': `${p.drift}px`,
              '--spin': `${p.spin}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}

function formatTime(ms: number) {
  const s = Math.max(1, Math.round(ms / 1000))
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
}

// "All tests passed ✅" with confetti and contact details, once the last card is closed.
export function EndScreen() {
  const ending = useGame(showingEnd)
  // Everything found: the only way on is to play again from the start.
  const complete = useGame(allDone)
  const hasGlass = useGame((s) => s.hasGlass)
  const found = useGame((s) => s.found.length)
  const time = useGame((s) => (s.lastCatch ? s.lastCatch.at - s.startedAt : 0))
  // A short pause after the last card, so the screen doesn't feel like part of it.
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!ending) return setShown(false)
    const t = setTimeout(() => setShown(true), 400)
    return () => clearTimeout(t)
  }, [ending, complete])
  const { button, ready, isReady } = useReadyButton(shown)

  useEffect(() => {
    if (shown) sfx.finale()
  }, [shown])

  if (!shown) return null
  const keepExploring = () => {
    if (isReady()) useGame.getState().dismissEnd()
  }
  // Reloads the site, so the game starts over from the very beginning.
  const playAgain = () => {
    window.location.hash = '#/'
    window.location.reload()
  }
  return (
    <div className="screen-backdrop screen-end" data-testid="end-screen">
      <Confetti />
      <section className="screen" role="dialog" aria-modal="true" aria-labelledby="end-title">
        <p className="screen-kicker">Test run complete</p>
        <h1 id="end-title" className="screen-title">
          All tests passed ✅
        </h1>
        <p className="end-stats">
          <strong>
            {BUGS.length} / {BUGS.length}
          </strong>{' '}
          bugs caught · <strong>100%</strong> coverage · done in <strong>{formatTime(time)}</strong>
        </p>
        {complete ? (
          <p className="screen-text">
            You caught every bug <strong>and</strong> found all {HIDDEN_BUGS.length} hidden ones. Nothing left to test:
            this QA engineer is ready to ship to your team. Thanks for playing!
          </p>
        ) : (
          <p className="screen-text">
            Zero open bugs, build is green. This QA engineer is ready to ship to your team.
            {hasGlass
              ? ` Bonus: ${found} / ${HIDDEN_BUGS.length} hidden bugs found. Keep exploring to find the rest.`
              : ' Psst: a magnifying glass by the start reveals hidden bugs.'}
          </p>
        )}
        <h2 className="end-contact-title">Let's talk</h2>
        <ContactList className="board-contact" />
        <div className={complete ? 'screen-actions end-actions end-actions-3' : 'screen-actions end-actions'}>
          <a className={complete ? 'btn btn-ghost' : 'btn btn-primary'} href={cvPdfUrl} download>
            Download CV
          </a>
          <a className="btn btn-ghost" href="#/cv">
            View CV
          </a>
          {complete ? null : (
            <button
              ref={button}
              className="btn btn-ghost"
              onClick={keepExploring}
              aria-disabled={!ready}
              data-testid="keep-exploring"
            >
              Keep exploring
            </button>
          )}
          <button
            ref={complete ? button : undefined}
            className={complete ? 'btn btn-primary' : 'btn btn-ghost'}
            onClick={playAgain}
            data-testid="play-again"
          >
            {complete ? 'Play again ↻' : 'Play again'}
          </button>
        </div>
        <TestThisSite />
      </section>
    </div>
  )
}

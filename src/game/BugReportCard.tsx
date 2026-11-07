import { useEffect, useRef, useState } from 'react'
import { reportById } from './reports'
import { CARD_SHOW_DELAY_MS, useGame } from './store'
import { BUGS } from './bugs'
import { sfx } from './sound'

/** After showing, the card ignores closing for a moment, so a player mashing Space doesn't skip it unread. */
const READY_AFTER_MS = CARD_SHOW_DELAY_MS + 500

const sinceOpened = () => performance.now() - useGame.getState().cardOpenedAt

// Jira-style ticket for the bug on top of the queue.
export function BugReportCard() {
  const id = useGame((s) => s.cardQueue[0])
  const waiting = useGame((s) => s.cardQueue.length - 1)
  const caught = useGame((s) => s.caught.length)
  const openedAt = useGame((s) => s.cardOpenedAt)
  const closeCard = useGame((s) => s.closeCard)
  // Only used to re-render when the card appears and when it becomes closable.
  const [, setTick] = useState(0)
  const button = useRef<HTMLButtonElement>(null)

  // Timing comes from the open time in the store, never from leftover component state.
  const elapsed = id ? performance.now() - openedAt : 0
  const shown = !!id && elapsed >= CARD_SHOW_DELAY_MS
  const ready = !!id && elapsed >= READY_AFTER_MS

  // Show the card after the catch animation, then focus the button so Space or Enter closes it.
  useEffect(() => {
    if (!id) return
    const left = (ms: number) => Math.max(0, ms - (performance.now() - openedAt))
    const show = setTimeout(() => setTick((n) => n + 1), left(CARD_SHOW_DELAY_MS))
    const focus = setTimeout(() => {
      setTick((n) => n + 1)
      button.current?.focus()
    }, left(READY_AFTER_MS))
    return () => {
      clearTimeout(show)
      clearTimeout(focus)
    }
  }, [id, openedAt])

  // Paper "ticket" sound each time a card appears, including the next one in the queue.
  useEffect(() => {
    if (shown) sfx.card()
  }, [shown, id])

  useEffect(() => {
    if (!id) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && sinceOpened() >= READY_AFTER_MS) useGame.getState().closeCard()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [id])

  const report = id ? reportById(id) : null
  if (!report || !shown) return null
  const close = () => {
    if (sinceOpened() >= READY_AFTER_MS) closeCard()
  }

  return (
    <div className="report-backdrop" onClick={close} data-testid="bug-report-backdrop">
      <article
        key={report.id}
        className={`report report-${report.kind}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        onClick={(e) => e.stopPropagation()}
        data-testid="bug-report"
      >
        <header className="report-head">
          <span className="report-id">{report.id}</span>
          <span className={`pill pill-${report.severity.toLowerCase()}`}>{report.severity}</span>
          <span className="pill pill-resolved">{report.status}</span>
          {report.badge ? <span className="report-star">{report.badge}</span> : null}
        </header>

        {report.headline ? <p className="report-headline">{report.headline}</p> : null}
        <h2 id="report-title" className="report-title">
          {report.title}
        </h2>

        <dl className="report-rows">
          <div>
            <dt>Found in</dt>
            <dd>{report.foundIn}</dd>
          </div>
          {report.rows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>

        <footer className="report-foot">
          <span className="muted">
            Coverage {caught} / {BUGS.length}
          </span>
          <button
            ref={button}
            className="btn btn-primary"
            onClick={close}
            aria-disabled={!ready}
            data-testid="bug-report-close"
          >
            {waiting > 0 ? `Next report (${waiting} more)` : 'Got it, keep hunting'}
          </button>
        </footer>
      </article>
    </div>
  )
}

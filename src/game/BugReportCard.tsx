import { useEffect, useRef, useState } from 'react'
import { reportById } from './reports'
import { useGame } from './store'
import { BUGS } from './bugs'

/** The card ignores closing for a moment, so a player mashing Space doesn't skip it unread. */
const READY_AFTER_MS = 650

// Jira-style ticket for the bug on top of the queue.
export function BugReportCard() {
  const id = useGame((s) => s.cardQueue[0])
  const waiting = useGame((s) => s.cardQueue.length - 1)
  const caught = useGame((s) => s.caught.length)
  const closeCard = useGame((s) => s.closeCard)
  const [ready, setReady] = useState(false)
  const button = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!id) return
    setReady(false)
    const t = setTimeout(() => setReady(true), READY_AFTER_MS)
    return () => clearTimeout(t)
  }, [id])

  // Focus the button once it is enabled, so Space or Enter closes the card.
  useEffect(() => {
    if (id && ready) button.current?.focus()
  }, [id, ready])

  useEffect(() => {
    if (!id || !ready) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') closeCard()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [id, ready, closeCard])

  const report = id ? reportById(id) : null
  if (!report) return null
  const close = () => ready && closeCard()

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
          <span className="pill pill-resolved">✔ Resolved</span>
          {report.kind === 'golden' ? <span className="report-star">★ Golden bug</span> : null}
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
            disabled={!ready}
            data-testid="bug-report-close"
          >
            {waiting > 0 ? `Next report (${waiting} more)` : 'Got it, keep hunting'}
          </button>
        </footer>
      </article>
    </div>
  )
}

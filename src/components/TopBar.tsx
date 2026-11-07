import { cv, cvPdfUrl } from '../data/cv'
import type { Route } from '../useRoute'

// Always visible, on every screen, so recruiters can reach the CV in one click.
export function TopBar({ route }: { route: Route }) {
  return (
    <header className="topbar" data-testid="top-bar">
      <a className="topbar-name" href="#/">
        🐞 {cv.shortName}
        <span className="topbar-role">QA Engineer</span>
      </a>
      <nav className="topbar-actions">
        {route === 'cv' ? (
          <a className="btn btn-ghost" href="#/">
            Play<span className="hide-sm"> the game</span>
          </a>
        ) : null}
        <a
          className="btn btn-ghost"
          href="#/cv"
          aria-current={route === 'cv' ? 'page' : undefined}
          data-testid="view-cv"
        >
          View CV
        </a>
        <a className="btn btn-primary" href={cvPdfUrl} download data-testid="download-cv">
          Download CV
        </a>
      </nav>
    </header>
  )
}

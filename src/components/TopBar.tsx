import { cv, cvPdfUrl } from '../data/cv'
import { useGame } from '../game/store'
import { useHelp } from '../helpState'
import { useSoundSettings } from '../soundSettings'
import type { Route } from '../useRoute'

// Always visible, on every screen, so recruiters can reach the CV in one click.
export function TopBar({ route }: { route: Route }) {
  // A game is under way: the CV page offers to go back to it rather than start one.
  const inGame = useGame((s) => s.started)
  return (
    <header className="topbar" data-testid="top-bar">
      <a className="topbar-name" href="#/">
        🐞 {cv.navName}
        <span className="topbar-role">QA Engineer</span>
      </a>
      <nav className="topbar-actions">
        {route === 'cv' ? (
          <a className="btn btn-ghost" href="#/" data-testid="play-game">
            {inGame ? (
              <>
                Back<span className="hide-sm"> to the game</span>
              </>
            ) : (
              <>
                Play<span className="hide-sm"> the game</span>
              </>
            )}
          </a>
        ) : (
          <>
            <MuteButton />
            <HelpButton />
          </>
        )}
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

// Only on the game screen. M toggles it too.
function MuteButton() {
  const muted = useSoundSettings((s) => s.muted)
  const toggle = useSoundSettings((s) => s.toggleMuted)
  return (
    <button
      type="button"
      className="btn btn-ghost btn-icon"
      // Drop focus after the click, or the next Space press (net swing) would toggle sound again.
      onClick={(e) => {
        toggle()
        e.currentTarget.blur()
      }}
      aria-pressed={muted}
      aria-label={muted ? 'Turn sound on (M)' : 'Mute sound (M)'}
      title={muted ? 'Turn sound on (M)' : 'Mute sound (M)'}
      data-testid="mute"
    >
      {muted ? '🔇' : '🔊'}
    </button>
  )
}

// Only on the game screen: opens the "How to play" panel.
function HelpButton() {
  const setOpen = useHelp((s) => s.setOpen)
  return (
    <button
      type="button"
      className="btn btn-ghost btn-icon"
      // Drop focus after the click, so Space swings the net instead of reopening the panel.
      onClick={(e) => {
        e.currentTarget.blur()
        setOpen(true)
      }}
      aria-label="How to play"
      title="How to play"
      data-testid="how-to-play-button"
    >
      ❓<span className="hide-sm"> How to play</span>
    </button>
  )
}

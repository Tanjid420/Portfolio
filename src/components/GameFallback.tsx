import { Component, type ReactNode } from 'react'
import { CvPage } from './CvPage'

/** The CV page with a short note on top. Shown when the 3D island can't run. */
export function GameFallback() {
  return (
    <CvPage
      notice={
        <p className="cv-notice" role="status" data-testid="game-fallback">
          🐞 The 3D island couldn't start on this device, so here's the CV instead. Everything from the game is below.
        </p>
      }
    />
  )
}

/** Catches crashes in the game (WebGL errors, a failed download) and shows the CV instead. */
export class GameErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('Game failed, showing the CV instead:', error)
  }

  render() {
    return this.state.failed ? <GameFallback /> : this.props.children
  }
}

import { lazy, Suspense } from 'react'
import { TopBar } from './components/TopBar'
import { CvPage } from './components/CvPage'
import { GameErrorBoundary, GameFallback } from './components/GameFallback'
import { hasWebGL } from './game/device'
import { useRoute } from './useRoute'

// The 3D bundle loads only on the game screen, so the CV page stays fast.
const Game = lazy(() => import('./game/Game'))
const canRun3D = hasWebGL()

export default function App() {
  const route = useRoute()
  return (
    <>
      <TopBar route={route} />
      {route === 'cv' ? (
        <CvPage />
      ) : !canRun3D ? (
        <GameFallback />
      ) : (
        <GameErrorBoundary>
          <div className="game" data-testid="game">
            <Suspense fallback={<p className="game-loading">Loading the island…</p>}>
              <Game />
            </Suspense>
          </div>
        </GameErrorBoundary>
      )}
    </>
  )
}

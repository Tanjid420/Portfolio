import { lazy, Suspense } from 'react'
import { TopBar } from './components/TopBar'
import { CvPage } from './components/CvPage'
import { useRoute } from './useRoute'

// The 3D bundle loads only on the game screen, so the CV page stays fast.
const Game = lazy(() => import('./game/Game'))

export default function App() {
  const route = useRoute()
  return (
    <>
      <TopBar route={route} />
      {route === 'cv' ? (
        <CvPage />
      ) : (
        <div className="game" data-testid="game">
          <Suspense fallback={<p className="game-loading">Loading the island…</p>}>
            <Game />
          </Suspense>
        </div>
      )}
    </>
  )
}

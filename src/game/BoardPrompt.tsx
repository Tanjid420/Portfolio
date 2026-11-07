import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import type { Group } from 'three'
import { isTouch } from './device'
import { canReadBoard } from './Screens'
import { useGame } from './store'

/** Height of the bubble above the ground, just over the hero's head. */
const ABOVE_HEAD = 4.3

// "Press E to read About Me" bubble over the hero's head, only next to the notice board.
export function BoardPrompt() {
  // Only re-renders when the answer changes, not every frame.
  const show = useGame(canReadBoard)
  const anchor = useRef<Group>(null)

  useFrame(() => {
    const [x, z] = useGame.getState().focus
    anchor.current?.position.set(x, ABOVE_HEAD, z)
  })

  return (
    <group ref={anchor}>
      {show ? (
        // Stays under the HUD and cards.
        <Html center zIndexRange={[16, 16]}>
          <button
            type="button"
            className="board-prompt"
            onClick={(e) => {
              e.currentTarget.blur()
              useGame.getState().setBoardOpen(true)
            }}
            data-testid="board-prompt"
          >
            {isTouch ? (
              <>📌 Tap to read About Me</>
            ) : (
              <>
                Press <kbd>E</kbd> to read About Me
              </>
            )}
          </button>
        </Html>
      ) : null}
    </group>
  )
}

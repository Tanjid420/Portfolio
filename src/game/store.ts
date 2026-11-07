import { create } from 'zustand'
import { ZONES } from './world'

const [startX, startZ] = ZONES[0].position

interface GameState {
  /** Player position on the ground as [x, z]. The camera follows it. */
  focus: [number, number]
  setFocus: (focus: [number, number]) => void
  /** Direction the player faces, in radians. 0 faces +z (toward the camera). */
  facing: number
  /** Where the net ring is, as [x, z], updated every frame. Used for catching bugs. */
  netPos: [number, number]
  /** Scene clock time (seconds) when the last net swing started. */
  swingStartedAt: number
  /** Ticket IDs of the bugs caught so far, in catch order. */
  caught: string[]
  /** The most recent catch. The bug report card (step 5) opens from this. */
  lastCatch: { id: string; at: number } | null
  catchBug: (id: string) => void
}

export const PLAYER_START: [number, number] = [startX, startZ + 2.5]

export const useGame = create<GameState>((set) => ({
  focus: PLAYER_START,
  setFocus: (focus) => set({ focus }),
  facing: 0,
  netPos: PLAYER_START,
  swingStartedAt: -Infinity,
  caught: [],
  lastCatch: null,
  catchBug: (id) =>
    set((s) => (s.caught.includes(id) ? s : { caught: [...s.caught, id], lastCatch: { id, at: performance.now() } })),
}))

// Lets local checks and tests read the game state from the browser console.
if (import.meta.env.DEV) (window as unknown as { __game: typeof useGame }).__game = useGame

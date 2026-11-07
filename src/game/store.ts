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
}

export const PLAYER_START: [number, number] = [startX, startZ + 2.5]

export const useGame = create<GameState>((set) => ({
  focus: PLAYER_START,
  setFocus: (focus) => set({ focus }),
  facing: 0,
  netPos: PLAYER_START,
  swingStartedAt: -Infinity,
}))

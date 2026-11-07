import { create } from 'zustand'
import { ZONES } from './world'

interface GameState {
  /** Point on the ground the camera follows, as [x, z]. The player sets this from step 3. */
  focus: [number, number]
  setFocus: (focus: [number, number]) => void
}

export const useGame = create<GameState>((set) => ({
  focus: ZONES[0].position,
  setFocus: (focus) => set({ focus }),
}))

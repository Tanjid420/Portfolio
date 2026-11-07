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
  /** The most recent catch. Used for catch effects. */
  lastCatch: { id: string; at: number } | null
  catchBug: (id: string) => void
  /** Bug report cards waiting to be read. The first one is on screen. One swing can catch two bugs. */
  cardQueue: string[]
  /** When the card on screen opened (performance.now()). Used to ignore closing for a moment. */
  cardOpenedAt: number
  closeCard: () => void
  /** True once the player picks up the magnifying glass. Hidden bugs only show up after that. */
  hasGlass: boolean
  pickUpGlass: () => void
  /** IDs of the hidden bugs found so far. They don't count toward coverage. */
  found: string[]
  findHidden: (id: string) => void
}

/** Card ID for the "you picked up the magnifying glass" card. */
export const GLASS_CARD_ID = 'TOOL-01'

/** Wait after a catch before the card shows, so the player sees the bug get scooped up. */
export const CARD_SHOW_DELAY_MS = 700

export const PLAYER_START: [number, number] = [startX, startZ + 2.5]

/** Adds a card to the queue. If none was showing, its timer starts now. */
function enqueue(s: GameState, id: string) {
  return {
    cardQueue: [...s.cardQueue, id],
    cardOpenedAt: s.cardQueue.length ? s.cardOpenedAt : performance.now(),
  }
}

export const useGame = create<GameState>((set) => ({
  focus: PLAYER_START,
  setFocus: (focus) => set({ focus }),
  facing: 0,
  netPos: PLAYER_START,
  swingStartedAt: -Infinity,
  caught: [],
  lastCatch: null,
  catchBug: (id) =>
    set((s) =>
      s.caught.includes(id)
        ? s
        : { caught: [...s.caught, id], lastCatch: { id, at: performance.now() }, ...enqueue(s, id) },
    ),
  cardQueue: [],
  cardOpenedAt: 0,
  // The next card in the queue shows right away: its catch animation already played.
  closeCard: () =>
    set((s) => ({ cardQueue: s.cardQueue.slice(1), cardOpenedAt: performance.now() - CARD_SHOW_DELAY_MS })),
  hasGlass: false,
  pickUpGlass: () => set((s) => (s.hasGlass ? s : { hasGlass: true, ...enqueue(s, GLASS_CARD_ID) })),
  found: [],
  findHidden: (id) => set((s) => (s.found.includes(id) ? s : { found: [...s.found, id], ...enqueue(s, id) })),
}))

// Lets local checks and tests read the game state from the browser console.
if (import.meta.env.DEV) (window as unknown as { __game: typeof useGame }).__game = useGame

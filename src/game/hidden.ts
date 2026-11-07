// Hidden easter-egg bugs. They show up only near the player once the magnifying glass is picked up.
// They hold fun facts and never count toward coverage.

import { funFacts } from '../data/funFacts'

export interface HiddenBugDef {
  /** Card ID, e.g. EGG-01. */
  id: string
  /** Spot on the ground, off the path and outside the zones, as [x, z]. */
  position: [number, number]
  factIndex: number
}

const ALL: HiddenBugDef[] = [
  { id: 'EGG-01', position: [12, 25], factIndex: 0 },
  { id: 'EGG-02', position: [-26, -6], factIndex: 1 },
  { id: 'EGG-03', position: [4, -7], factIndex: 2 },
  { id: 'EGG-04', position: [24, 20], factIndex: 3 },
  { id: 'EGG-05', position: [-8, 5], factIndex: 4 },
  { id: 'EGG-06', position: [-29, 18], factIndex: 5 },
  { id: 'EGG-07', position: [28, -6], factIndex: 6 },
  { id: 'EGG-08', position: [8, 8], factIndex: 7 },
]

/** One hidden bug per fun fact, so removing a fact removes its bug. */
export const HIDDEN_BUGS = ALL.filter((b) => b.factIndex < funFacts.length)

/** Hidden bugs fade in when the player (with the glass) is this close. */
export const REVEAL_DISTANCE = 7

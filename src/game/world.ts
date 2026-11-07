// Island layout: zone spots, the path between them, and the coastline.
// Everything is deterministic so the island looks the same on every visit.

export type ZoneId = 'welcome' | 'office' | 'workshop' | 'testlab' | 'academy'

export interface Zone {
  id: ZoneId
  name: string
  section: string
  /** Center on the ground, as [x, z]. */
  position: [number, number]
  radius: number
}

// Listed in CV order. The path visits them in this order.
export const ZONES: Zone[] = [
  { id: 'welcome', name: 'Welcome Zone', section: 'About Me', position: [0, 21], radius: 4.5 },
  { id: 'office', name: 'Office Zone', section: 'Professional Experience', position: [-19, 7], radius: 5 },
  { id: 'workshop', name: 'Workshop Zone', section: 'Contributions', position: [-11, -13], radius: 6.5 },
  { id: 'testlab', name: 'Test Lab Zone', section: 'Skills', position: [12, -14], radius: 5.5 },
  { id: 'academy', name: 'Academy Zone', section: 'Education', position: [20, 5], radius: 5 },
]

export const ISLAND_RADIUS = 37

/** Distance from the island center to the grass edge at a given angle. */
export function coastRadius(angle: number): number {
  return (
    ISLAND_RADIUS +
    3 * Math.sin(3 * angle + 0.5) +
    2 * Math.sin(5 * angle + 1.3) +
    1.2 * Math.sin(9 * angle)
  )
}

/** True when (x, z) is on the grass, at least `margin` away from the edge. */
export function isOnIsland(x: number, z: number, margin = 0): boolean {
  return Math.hypot(x, z) <= coastRadius(Math.atan2(z, x)) - margin
}

// Path control points: each zone plus a few bends so it winds a little.
export const PATH_POINTS: [number, number][] = [
  [0, 34],
  ZONES[0].position,
  [-9, 17],
  ZONES[1].position,
  [-18, -3],
  ZONES[2].position,
  [0, -19],
  ZONES[3].position,
  [20, -6],
  ZONES[4].position,
]

/** Small seeded random generator (mulberry32). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

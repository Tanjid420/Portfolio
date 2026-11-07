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

// Mountains on the north shore: [x, z, base radius, height]
export const MOUNTAINS: [number, number, number, number][] = [
  [-2, -29, 6, 9],
  [7, -28, 4.5, 6.5],
  [-21, -22, 4, 5.5],
  [27, -17, 3.5, 5],
]

export interface Building {
  zone: ZoneId
  /** Center on the ground, as [x, z]. */
  position: [number, number]
  /** Solid footprint radius, for walking. */
  radius: number
  /** Turned so the door faces halfway between its zone and the camera, so the front stays in view. */
  facing: number
}

// One building per zone, placed behind or beside it so the camera can still see the zone.
const BUILDING_SPOTS: [ZoneId, number, number][] = [
  ['office', -25, 1.5],
  ['workshop', -11, -22.5],
  ['testlab', 13, -22.5],
  ['academy', 28, 4],
]

export const BUILDINGS: Building[] = BUILDING_SPOTS.map(([zone, x, z]) => {
  const [zx, zz] = ZONES.find((zn) => zn.id === zone)!.position
  return { zone, position: [x, z], radius: 3, facing: Math.atan2(zx - x, zz - z) / 2 }
})

/** Notice board in the Welcome Zone, facing the camera. */
export const NOTICE_BOARD: [number, number] = [3, 18.6]
/** Pedestal with the magnifying glass, next to where the player starts. */
export const MAGNIFIER_SPOT: [number, number] = [-2.8, 19.2]

/** Things the player and bugs can't walk through, besides trees, rocks and mountains: [x, z, radius]. */
const PROP_OBSTACLES: [number, number, number][] = [
  ...BUILDINGS.map((b): [number, number, number] => [...b.position, b.radius]),
  [...NOTICE_BOARD, 0.9],
  [...MAGNIFIER_SPOT, 0.45],
]

// Trees and rocks the player can't walk through, as [x, z, radius]. Filled by the island scatter.
let scatterObstacles: [number, number, number][] = []
export function setScatterObstacles(list: [number, number, number][]) {
  scatterObstacles = list
}

/** True when a body of `radius` can stand at (x, z): on the grass and clear of mountains, trees and rocks. */
export function isWalkable(x: number, z: number, radius = 0.5): boolean {
  if (!isOnIsland(x, z, radius + 0.4)) return false
  if (MOUNTAINS.some(([mx, mz, mr]) => Math.hypot(x - mx, z - mz) < mr * 0.95 + radius)) return false
  const clear = ([ox, oz, or]: [number, number, number]) => Math.hypot(x - ox, z - oz) >= or + radius
  return PROP_OBSTACLES.every(clear) && scatterObstacles.every(clear)
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

// The 8 bugs: where they live, what CV part they hold, and how they move.
// Pure logic, no React, so it is easy to test.

import { isWalkable, ZONES, type Zone, type ZoneId } from './world'

export type BugKind = 'normal' | 'golden' | 'boss'

/** Which part of the CV the bug report card shows (filled in step 5). */
export type BugContent =
  | { type: 'job' }
  | { type: 'contribution'; groupId: string }
  | { type: 'skills'; skillBugId: string }
  | { type: 'education' }

export interface BugDef {
  /** Ticket ID shown on the card, e.g. BUG-003. */
  id: string
  kind: BugKind
  zone: ZoneId
  /** Start spot as an offset from the zone center, [x, z]. */
  start: [number, number]
  content: BugContent
}

// Listed in path order, so ticket numbers rise as the player walks the island.
export const BUGS: BugDef[] = [
  { id: 'BUG-001', kind: 'boss', zone: 'office', start: [1, -1], content: { type: 'job' } },
  { id: 'BUG-002', kind: 'golden', zone: 'workshop', start: [-3, 1.5], content: { type: 'contribution', groupId: 'finding-bugs' } },
  { id: 'BUG-003', kind: 'golden', zone: 'workshop', start: [2.5, 2.5], content: { type: 'contribution', groupId: 'stopping-bugs-early' } },
  { id: 'BUG-004', kind: 'golden', zone: 'workshop', start: [3, -2.5], content: { type: 'contribution', groupId: 'owning-quality' } },
  { id: 'BUG-005', kind: 'golden', zone: 'workshop', start: [-2, -3], content: { type: 'contribution', groupId: 'leveling-up' } },
  { id: 'BUG-006', kind: 'normal', zone: 'testlab', start: [-2, 1.5], content: { type: 'skills', skillBugId: 'how-i-test' } },
  { id: 'BUG-007', kind: 'normal', zone: 'testlab', start: [2.5, -1], content: { type: 'skills', skillBugId: 'what-i-test-with' } },
  { id: 'BUG-008', kind: 'normal', zone: 'academy', start: [0, 0], content: { type: 'education' } },
]

export interface BugSpec {
  /** Model scale. */
  scale: number
  /** Body radius on the ground, for walls and edges. */
  radius: number
  wanderSpeed: number
  /** Always slower than the player (7), so every bug can be caught. */
  fleeSpeed: number
  /** How close the net ring must come, in world units. */
  catchRadius: number
}

export const BUG_SPECS: Record<BugKind, BugSpec> = {
  normal: { scale: 1.3, radius: 0.5, wanderSpeed: 1.6, fleeSpeed: 4, catchRadius: 1.4 },
  golden: { scale: 1.3, radius: 0.5, wanderSpeed: 1.8, fleeSpeed: 4.3, catchRadius: 1.4 },
  boss: { scale: 2.4, radius: 1, wanderSpeed: 1.2, fleeSpeed: 3.2, catchRadius: 2 },
}

/** Bugs start running when the player is this close... */
const FLEE_START = 5
/** ...and calm down once the player is this far away. */
const FLEE_STOP = 7.5
/** How far past the zone edge a bug may run. Keeps it findable and lets the player corner it. */
const LEASH = 3

export interface BugMotion {
  x: number
  z: number
  facing: number
  mode: 'idle' | 'walk' | 'flee'
  /** Seconds left to stand still while idle. */
  timer: number
  target: [number, number]
  /** Leg cycle, advances with distance moved. */
  phase: number
  /** Distance moved in the last step, for animation. */
  moved: number
}

export function zoneOf(def: BugDef): Zone {
  return ZONES.find((z) => z.id === def.zone)!
}

export function startMotion(def: BugDef): BugMotion {
  const zone = zoneOf(def)
  const x = zone.position[0] + def.start[0]
  const z = zone.position[1] + def.start[1]
  return { x, z, facing: Math.atan2(-def.start[0], -def.start[1]), mode: 'idle', timer: Math.random() * 2, target: [x, z], phase: 0, moved: 0 }
}

function canStand(x: number, z: number, zone: Zone, spec: BugSpec) {
  const [cx, cz] = zone.position
  return Math.hypot(x - cx, z - cz) <= zone.radius + LEASH && isWalkable(x, z, spec.radius)
}

/** Picks a random walkable spot inside the zone to stroll to. */
function pickTarget(zone: Zone, spec: BugSpec, rand: () => number): [number, number] | null {
  const [cx, cz] = zone.position
  for (let i = 0; i < 6; i++) {
    const a = rand() * Math.PI * 2
    const r = Math.sqrt(rand()) * zone.radius * 0.85
    const x = cx + Math.cos(a) * r
    const z = cz + Math.sin(a) * r
    if (canStand(x, z, zone, spec)) return [x, z]
  }
  return null
}

/** Moves one bug forward by `dt` seconds. Mutates `m`. */
export function stepBug(m: BugMotion, def: BugDef, player: [number, number], dt: number, rand = Math.random) {
  const zone = zoneOf(def)
  const spec = BUG_SPECS[def.kind]
  const [px, pz] = player
  const dist = Math.hypot(m.x - px, m.z - pz)

  if (dist < FLEE_START) m.mode = 'flee'
  else if (m.mode === 'flee' && dist > FLEE_STOP) {
    m.mode = 'idle'
    m.timer = 0.5 + rand()
  }

  let dirX = 0
  let dirZ = 0
  let speed = 0
  if (m.mode === 'flee') {
    dirX = (m.x - px) / (dist || 1)
    dirZ = (m.z - pz) / (dist || 1)
    speed = BUG_SPECS[def.kind].fleeSpeed
  } else if (m.mode === 'walk') {
    const tx = m.target[0] - m.x
    const tz = m.target[1] - m.z
    const left = Math.hypot(tx, tz)
    if (left < 0.3) {
      m.mode = 'idle'
      m.timer = 1 + rand() * 2
    } else {
      dirX = tx / left
      dirZ = tz / left
      speed = spec.wanderSpeed
    }
  } else {
    m.timer -= dt
    if (m.timer <= 0) {
      const target = pickTarget(zone, spec, rand)
      if (target) {
        m.target = target
        m.mode = 'walk'
      } else m.timer = 1
    }
  }

  m.moved = 0
  if (speed > 0) {
    const step = speed * dt
    const base = Math.atan2(dirX, dirZ)
    // When blocked, turn toward the zone center first, so a fleeing bug circles instead of sticking.
    const toCx = zone.position[0] - m.x
    const toCz = zone.position[1] - m.z
    const side = dirZ * toCx - dirX * toCz >= 0 ? 1 : -1
    for (const turn of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) {
      const a = base + turn * side
      const nx = m.x + Math.sin(a) * step
      const nz = m.z + Math.cos(a) * step
      if (canStand(nx, nz, zone, spec)) {
        m.x = nx
        m.z = nz
        m.moved = step
        let diff = a - m.facing
        diff = Math.atan2(Math.sin(diff), Math.cos(diff))
        m.facing += diff * (1 - Math.exp(-12 * dt))
        break
      }
    }
    if (m.moved === 0 && m.mode === 'walk') {
      m.mode = 'idle'
      m.timer = 0.5
    }
  }
  m.phase += m.moved * 9
}

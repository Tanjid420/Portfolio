import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { quality } from './device'
import { BEACH_TOP } from './Island'
import { coastRadius } from './world'

// Little crabs that scuttle sideways along the beach, stop, and snap their claws.
// A few always live in front of the Welcome Zone, where the game starts.

interface CrabDef {
  /** Home spot on the beach, as an angle around the island (90° is straight in front of the Welcome Zone). */
  home: number
  /** How far either side of home it wanders, in degrees. */
  range: number
  /** How far across the sand it walks: 0 = grass edge, 1 = water's edge. */
  across: number
  size: number
}

const deg = (d: number) => (d * Math.PI) / 180

const WELCOME_CRABS: CrabDef[] = [
  { home: 83, range: 5, across: 0.45, size: 1.4 },
  { home: 92, range: 4, across: 0.7, size: 1.25 },
  { home: 100, range: 5, across: 0.35, size: 1.5 },
]
const OTHER_CRABS: CrabDef[] = [
  { home: 15, range: 8, across: 0.5, size: 1.3 },
  { home: 145, range: 8, across: 0.55, size: 1.4 },
  { home: 205, range: 8, across: 0.4, size: 1.3 },
  { home: 320, range: 8, across: 0.6, size: 1.35 },
]
const CRABS = quality === 'low' ? [...WELCOME_CRABS, ...OTHER_CRABS.slice(0, 2)] : [...WELCOME_CRABS, ...OTHER_CRABS]

/** Sand starts this far out from the grass edge and is this wide (the beach slab is 3 units). */
const SAND_FROM = 0.7
const SAND_WIDTH = 1.6
const WALK_SPEED = 0.55

const UP = new Vector3(0, 1, 0)

/** Tapered rod from a to b (radius r1 at a, r2 at b). */
function rod(a: [number, number, number], b: [number, number, number], r1: number, r2: number): BufferGeometry {
  const from = new Vector3(...a)
  const dir = new Vector3(...b).sub(from)
  const g = new CylinderGeometry(r2, r1, dir.length(), 6)
  g.translate(0, dir.length() / 2, 0)
  g.applyQuaternion(new Quaternion().setFromUnitVectors(UP, dir.normalize()))
  g.translate(from.x, from.y, from.z)
  return g
}

function ball(at: [number, number, number], scale: [number, number, number], radius = 1): BufferGeometry {
  const g = new SphereGeometry(radius, 12, 8)
  g.scale(...scale)
  g.translate(...at)
  return g
}

function useCrabParts() {
  return useMemo(() => {
    // Shell: wide and flat, a little broader at the front, with eye stalks on top.
    const shell = new SphereGeometry(1, 18, 10)
    const p = shell.attributes.position
    for (let i = 0; i < p.count; i++) {
      const z = p.getZ(i)
      p.setX(i, p.getX(i) * (1 + 0.12 * z))
    }
    shell.scale(0.3, 0.12, 0.23)
    shell.computeVertexNormals()
    const body = mergeGeometries([
      shell,
      ball([0, -0.03, 0], [0.26, 0.07, 0.2]),
      rod([0.07, 0.08, 0.17], [0.08, 0.17, 0.2], 0.016, 0.014),
      rod([-0.07, 0.08, 0.17], [-0.08, 0.17, 0.2], 0.016, 0.014),
    ])!

    // Leg for the right side, attached at the origin: up and out to the knee, then down to the sand.
    const leg = mergeGeometries([
      rod([0, 0, 0], [0.17, 0.07, 0], 0.024, 0.02),
      rod([0.17, 0.07, 0], [0.3, -0.13, 0], 0.02, 0.008),
      ball([0.17, 0.07, 0], [1, 1, 1], 0.021),
    ])!

    // Right claw arm, attached at the origin, reaching forward; the lower jaw is fixed.
    const arm = mergeGeometries([
      rod([0, 0, 0], [0.1, 0.03, 0.08], 0.03, 0.026),
      rod([0.1, 0.03, 0.08], [0.1, 0.05, 0.2], 0.026, 0.03),
      ball([0.1, 0.05, 0.24], [0.055, 0.045, 0.07]),
      (() => {
        const jaw = new ConeGeometry(0.022, 0.11, 6)
        jaw.rotateX(Math.PI / 2)
        jaw.translate(0.11, 0.03, 0.34)
        return jaw
      })(),
    ])!
    // Moving top jaw, hinged at the back so it can open upward.
    const jaw = new ConeGeometry(0.02, 0.11, 6)
    jaw.rotateX(Math.PI / 2)
    jaw.translate(0, 0, 0.055)

    return {
      body,
      leg,
      arm,
      jaw,
      shell: new MeshStandardMaterial({ color: '#D9562B', roughness: 0.55 }),
      limb: new MeshStandardMaterial({ color: '#E8774A', roughness: 0.6 }),
      eye: new MeshStandardMaterial({ color: '#111111', roughness: 0.2 }),
    }
  }, [])
}

// Leg attach points along the side, front to back, and how far each fans out.
const LEGS: { z: number; spread: number }[] = [
  { z: 0.1, spread: -0.55 },
  { z: 0.03, spread: -0.15 },
  { z: -0.05, spread: 0.2 },
  { z: -0.12, spread: 0.55 },
]

function Crab({ def, index }: { def: CrabDef; index: number }) {
  const parts = useCrabParts()
  const root = useRef<Group>(null)
  const body = useRef<Group>(null)
  const legs = useRef<(Group | null)[]>([])
  const arms = useRef<(Group | null)[]>([])
  const jaws = useRef<(Group | null)[]>([])
  const state = useRef({
    angle: deg(def.home + (Math.random() - 0.5) * def.range),
    dir: Math.random() < 0.5 ? 1 : -1,
    walking: false,
    until: Math.random() * 2,
    stride: 0,
    walk: 0,
    snapSeed: index * 1.7,
  })

  useFrame(({ clock }, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const t = clock.elapsedTime
    const s = state.current

    // Take turns walking and resting. Turn back at the edge of home.
    if (t > s.until) {
      s.walking = !s.walking
      s.until = t + (s.walking ? 1 + Math.random() * 2.5 : 1.5 + Math.random() * 3.5)
      if (s.walking && Math.random() < 0.4) s.dir *= -1
    }
    const offset = s.angle - deg(def.home)
    if (Math.abs(offset) > deg(def.range)) s.dir = offset > 0 ? -1 : 1

    const r = coastRadius(s.angle) + SAND_FROM + def.across * SAND_WIDTH
    if (s.walking) {
      s.angle += (s.dir * WALK_SPEED * delta) / r
      s.stride += WALK_SPEED * delta
    }
    s.walk += ((s.walking ? 1 : 0) - s.walk) * (1 - Math.exp(-10 * delta))

    const g = root.current
    if (!g) return
    const x = r * Math.cos(s.angle)
    const z = r * Math.sin(s.angle)
    g.position.set(x, BEACH_TOP, z)
    // Face the sea; walking around the island is then sideways, like a real crab.
    g.rotation.y = Math.atan2(Math.cos(s.angle), Math.sin(s.angle))

    const phase = s.stride * 28
    if (body.current) body.current.position.y = 0.14 + Math.abs(Math.sin(phase)) * 0.012 * s.walk
    legs.current.forEach((leg, i) => {
      if (!leg) return
      // Neighbouring legs move in opposite beats; each side mirrors the other.
      const beat = phase + i * Math.PI * 0.5 + (i >= LEGS.length ? Math.PI : 0)
      leg.rotation.z = Math.max(0, Math.sin(beat)) * 0.35 * s.walk
      leg.rotation.y = LEGS[i % LEGS.length].spread + Math.cos(beat) * 0.2 * s.walk
    })
    // At rest the claws lift and snap now and then.
    const rest = 1 - s.walk
    const snap = Math.pow(Math.max(0, Math.sin(t * 5 + s.snapSeed)), 6)
    arms.current.forEach((arm, i) => {
      if (arm) arm.rotation.x = -0.25 * rest - Math.sin(t * 2 + i) * 0.06 * rest
    })
    jaws.current.forEach((jaw, i) => {
      if (jaw) jaw.rotation.x = -(0.08 + 0.45 * snap * rest + (i ? 0 : 0.1 * Math.sin(t * 3)))
    })
  })

  return (
    <group ref={root} scale={def.size}>
      <group ref={body} position-y={0.14}>
        <mesh geometry={parts.body} material={parts.shell} castShadow />
        {[1, -1].map((side) => (
          <mesh key={side} position={[side * 0.08, 0.18, 0.2]} material={parts.eye}>
            <sphereGeometry args={[0.022, 8, 6]} />
          </mesh>
        ))}
        {/* Legs: the left side is the right side mirrored. */}
        {[1, -1].map((side, si) => (
          <group key={side} scale-x={side}>
            {LEGS.map((leg, i) => (
              <group key={i} ref={(g) => void (legs.current[si * LEGS.length + i] = g)} position={[0.24, -0.01, leg.z]}>
                <mesh geometry={parts.leg} material={parts.limb} />
              </group>
            ))}
            <group ref={(g) => void (arms.current[si] = g)} position={[0.17, 0, 0.17]}>
              <mesh geometry={parts.arm} material={parts.limb} />
              <group ref={(g) => void (jaws.current[si] = g)} position={[0.095, 0.065, 0.28]}>
                <mesh geometry={parts.jaw} material={parts.limb} />
              </group>
            </group>
          </group>
        ))}
      </group>
    </group>
  )
}

export function Crabs() {
  return (
    <>
      {CRABS.map((def, i) => (
        <Crab key={i} def={def} index={i} />
      ))}
    </>
  )
}

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BufferGeometry,
  Color,
  DoubleSide,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  LatheGeometry,
  MeshStandardMaterial,
  Shape,
  Vector2,
} from 'three'
import { useGame } from './store'

// Now and then a small flock of seagulls crosses the sky over the player.

const MAX_BIRDS = 5
const SPEED = 7
const HALF_TRIP = 48

interface Bird {
  active: boolean
  /** Where the bird sits in the V, relative to the leader: [back, side]. */
  slot: [number, number]
  flapOffset: number
}

interface Flight {
  start: number
  x: number
  z: number
  dx: number
  dz: number
  height: number
  bend: number
}

/** Plump body with a round head, made by spinning a side profile. Head points +z. */
function bodyGeometry(): BufferGeometry {
  // [radius, position along the body], tail to crown.
  const profile: [number, number][] = [
    [0, -0.5],
    [0.035, -0.46],
    [0.08, -0.32],
    [0.12, -0.12],
    [0.135, 0.04],
    [0.12, 0.18],
    [0.08, 0.27],
    [0.085, 0.31],
    [0.09, 0.37],
    [0.07, 0.44],
    [0, 0.48],
  ]
  const g = new LatheGeometry(
    profile.map(([r, y]) => new Vector2(r, y)),
    10,
  )
  g.rotateX(Math.PI / 2)
  g.scale(0.9, 1, 1)
  g.computeVertexNormals()
  return g
}

/**
 * Flat wing panel from an outline drawn with x outward and y forward, laid flat (forward = +z).
 * Grey on top, with black tips past `tipFrom` on the outer panel.
 */
function wingGeometry(points: [number, number][], tipFrom: number): BufferGeometry {
  const shape = new Shape(points.map(([x, y]) => new Vector2(x, y)))
  const g = new ExtrudeGeometry(shape, { depth: 0.025, bevelEnabled: false, curveSegments: 4 })
  g.translate(0, 0, -0.0125)
  g.rotateX(Math.PI / 2)
  const grey = new Color('#C9D2D8')
  const black = new Color('#2A2E33')
  const c = new Color()
  const p = g.attributes.position
  const colors: number[] = []
  for (let i = 0; i < p.count; i++) {
    c.lerpColors(grey, black, Math.min(Math.max((p.getX(i) - tipFrom) / 0.08, 0), 1))
    colors.push(c.r, c.g, c.b)
  }
  g.setAttribute('color', new Float32BufferAttribute(colors, 3))
  g.computeVertexNormals()
  return g
}

function useBirdParts() {
  return useMemo(() => {
    const tail = new Shape(
      [
        [0, 0],
        [0.11, -0.2],
        [0, -0.17],
        [-0.11, -0.2],
      ].map(([x, y]) => new Vector2(x, y)),
    )
    const tailGeo = new ExtrudeGeometry(tail, { depth: 0.02, bevelEnabled: false })
    tailGeo.rotateX(Math.PI / 2)
    return {
      body: bodyGeometry(),
      // Inner wing: shoulder to elbow, broad.
      inner: wingGeometry(
        [
          [0, 0.13],
          [0.25, 0.14],
          [0.5, 0.1],
          [0.5, -0.16],
          [0.2, -0.17],
          [0, -0.14],
        ],
        9,
      ),
      // Outer wing: elbow to a pointed, swept-back tip.
      outer: wingGeometry(
        [
          [0, 0.1],
          [0.3, 0.07],
          [0.6, -0.06],
          [0.66, -0.14],
          [0.45, -0.15],
          [0.2, -0.17],
          [0, -0.16],
        ],
        0.38,
      ),
      tail: tailGeo,
      white: new MeshStandardMaterial({ color: '#F7F7F2', roughness: 0.7 }),
      wing: new MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: DoubleSide }),
      beak: new MeshStandardMaterial({ color: '#F2C14E', roughness: 0.5 }),
      eye: new MeshStandardMaterial({ color: '#1A1E22' }),
    }
  }, [])
}

/** Wing joints register here: [left shoulder, left elbow, right shoulder, right elbow]. */
type JointRef = (g: Group | null, joint: number) => void

function Gull({ joints }: { joints: JointRef }) {
  const parts = useBirdParts()
  return (
    <>
      <mesh geometry={parts.body} material={parts.white} castShadow />
      <mesh geometry={parts.tail} material={parts.white} position={[0, 0.01, -0.42]} />
      <mesh position={[0, -0.01, 0.53]} rotation-x={Math.PI / 2} material={parts.beak}>
        <coneGeometry args={[0.028, 0.14, 5]} />
      </mesh>
      {[1, -1].map((side) => (
        <mesh key={side} position={[side * 0.065, 0.03, 0.4]} material={parts.eye}>
          <sphereGeometry args={[0.014, 5, 4]} />
        </mesh>
      ))}
      {/* The right wing is the left one mirrored, so the same angles flap both. */}
      {[0, 1].map((side) => (
        <group key={side} scale-x={side ? -1 : 1} position={[0, 0.04, 0.06]}>
          <group ref={(g) => joints(g, side * 2)} position-x={0.08}>
            <mesh geometry={parts.inner} material={parts.wing} castShadow />
            <group ref={(g) => joints(g, side * 2 + 1)} position-x={0.49}>
              <mesh geometry={parts.outer} material={parts.wing} castShadow />
            </group>
          </group>
        </group>
      ))}
    </>
  )
}

export function Birds() {
  const groups = useRef<(Group | null)[]>([])
  const jointRefs = useRef<(Group | null)[]>([])
  const birds = useMemo<Bird[]>(
    () => Array.from({ length: MAX_BIRDS }, () => ({ active: false, slot: [0, 0], flapOffset: 0 })),
    [],
  )
  const flight = useRef<Flight | null>(null)
  const next = useRef(5)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime

    if (!flight.current && t > next.current) {
      const [fx, fz] = useGame.getState().focus
      const a = Math.random() * Math.PI * 2
      const dx = Math.cos(a)
      const dz = Math.sin(a)
      // Start off screen and pass near the player, not always straight overhead.
      const side = (Math.random() - 0.5) * 16
      flight.current = {
        start: t,
        x: fx - dx * HALF_TRIP - dz * side,
        z: fz - dz * HALF_TRIP + dx * side,
        dx,
        dz,
        height: 9 + Math.random() * 4,
        bend: (Math.random() - 0.5) * 0.5,
      }
      const count = 2 + Math.floor(Math.random() * (MAX_BIRDS - 1))
      birds.forEach((b, i) => {
        b.active = i < count
        const row = Math.ceil(i / 2)
        b.slot = [row * 1.3 + Math.random() * 0.4, (i % 2 ? 1 : -1) * row * 1.2 + (Math.random() - 0.5) * 0.4]
        b.flapOffset = Math.random() * Math.PI * 2
      })
    }

    const f = flight.current
    const age = f ? t - f.start : 0
    if (f && age * SPEED > HALF_TRIP * 2 + 10) {
      flight.current = null
      next.current = t + 8 + Math.random() * 14
    }

    birds.forEach((b, i) => {
      const g = groups.current[i]
      if (!g) return
      g.visible = !!flight.current && b.active
      if (!g.visible || !f) return
      // A gentle curve: the heading turns slowly as the flock goes.
      const turn = f.bend * (age / 10)
      const hx = Math.cos(Math.atan2(f.dz, f.dx) + turn)
      const hz = Math.sin(Math.atan2(f.dz, f.dx) + turn)
      const d = age * SPEED
      const lx = f.x + f.dx * d + (hx - f.dx) * d * 0.5
      const lz = f.z + f.dz * d + (hz - f.dz) * d * 0.5
      const [back, side] = b.slot
      // Flap for a while, then glide with wings held out in a shallow "M".
      const flapping = Math.sin(t * 0.6 + b.flapOffset) > -0.2
      const phase = t * 9 + b.flapOffset
      const shoulder = flapping ? Math.sin(phase) * 0.55 + 0.1 : 0.12
      // The wingtip trails the shoulder a little, which makes the stroke look soft.
      const elbow = flapping ? Math.sin(phase - 0.9) * 0.45 : -0.18
      g.position.set(
        lx - hx * back - hz * side,
        f.height + Math.sin(t * 0.9 + b.flapOffset) * 0.3 - (flapping ? Math.sin(phase) * 0.04 : 0),
        lz - hz * back + hx * side,
      )
      g.rotation.set(flapping ? 0 : 0.06, Math.atan2(hx, hz), -f.bend * 0.6, 'YXZ')
      for (let s = 0; s < 2; s++) {
        const sh = jointRefs.current[i * 4 + s * 2]
        const el = jointRefs.current[i * 4 + s * 2 + 1]
        if (sh) sh.rotation.z = shoulder
        if (el) el.rotation.z = elbow
      }
    })
  })

  return (
    <>
      {birds.map((_, i) => (
        <group key={i} ref={(g) => void (groups.current[i] = g)} visible={false} scale={0.72}>
          <Gull joints={(g, joint) => void (jointRefs.current[i * 4 + joint] = g)} />
        </group>
      ))}
    </>
  )
}

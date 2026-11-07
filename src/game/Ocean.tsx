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
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Shape,
  Vector2,
} from 'three'
import { quality } from './device'
import { islandShape, WATER_Y } from './Island'
import { useGame } from './store'
import { coastRadius } from './world'

// Waves move in the shader, so the whole ocean costs one draw call.
// waveHeight (JS) and WAVE_GLSL must stay the same formula: boats and dolphins ride the JS copy.

const OCEAN = '#2A8C9E'
const FOAM = '#7FCBD6'

/** Waves are calm near the beach and grow out at sea. */
function calm(r: number): number {
  const t = Math.min(Math.max((r - 36) / 14, 0), 1)
  return 0.3 + 0.7 * t * t * (3 - 2 * t)
}

export function waveHeight(x: number, z: number, t: number): number {
  const h =
    0.2 * Math.sin(0.33 * x + 1.1 * t) +
    0.14 * Math.sin(0.47 * z - 0.9 * t + 1.7) +
    0.07 * Math.sin(0.9 * (x + z) + 1.7 * t)
  return h * calm(Math.hypot(x, z))
}

const WAVE_GLSL = /* glsl */ `
uniform float uTime;
varying float vWave;
float waveHeight(float x, float z, float t) {
  float h = 0.2 * sin(0.33 * x + 1.1 * t)
          + 0.14 * sin(0.47 * z - 0.9 * t + 1.7)
          + 0.07 * sin(0.9 * (x + z) + 1.7 * t);
  float c = smoothstep(36.0, 50.0, length(vec2(x, z)));
  return h * (0.3 + 0.7 * c);
}
`

function Water() {
  const foam = useRef<Mesh>(null)
  const foamShape = useMemo(() => islandShape(4.5), [])
  const time = useMemo(() => ({ value: 0 }), [])
  const material = useMemo(() => {
    const m = new MeshStandardMaterial({ color: OCEAN, roughness: 0.3, metalness: 0.1, flatShading: true })
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = time
      shader.vertexShader =
        WAVE_GLSL +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
        vec4 wavePos = modelMatrix * vec4(transformed, 1.0);
        vWave = waveHeight(wavePos.x, wavePos.z, uTime);
        transformed.z += vWave;`,
        )
      // Lighten the wave crests.
      shader.fragmentShader =
        'varying float vWave;\n' +
        shader.fragmentShader.replace(
          '#include <color_fragment>',
          `#include <color_fragment>
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.6, 0.85, 0.88), smoothstep(0.1, 0.32, vWave));`,
        )
    }
    return m
  }, [time])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    time.value = t
    if (foam.current) {
      foam.current.position.y = WATER_Y + 0.06 + Math.sin(t * 1.2) * 0.05
      const s = 1 + Math.sin(t * 0.8) * 0.012
      foam.current.scale.set(s, s, 1)
    }
  })

  const segments = quality === 'low' ? 100 : 150
  return (
    <>
      {/* The plane is laid flat, so its local z is world up: the shader lifts z. */}
      <mesh rotation-x={-Math.PI / 2} position-y={WATER_Y} receiveShadow material={material}>
        <planeGeometry args={[300, 300, segments, segments]} />
      </mesh>
      <mesh ref={foam} rotation-x={-Math.PI / 2}>
        <shapeGeometry args={[foamShape]} />
        <meshStandardMaterial color={FOAM} transparent opacity={0.45} roughness={0.6} />
      </mesh>
    </>
  )
}

// ---- Boats ----
// Hull is lofted from cross-sections: round bilge, V keel, bow rising to a point. Bow is local -z.

const STERN_Z = 1.3
const BOW_Z = -1.75
const DECK_Y = 0.46

/** Half-width of the hull at t (0 = stern, 1 = bow). */
function hullWidth(t: number): number {
  const k = (t - 0.4) / 0.6
  return 0.62 * Math.sqrt(Math.max(0, 1 - k * k))
}

function hullGeometry(bottom: string): BufferGeometry {
  const stations = 18
  const rings: [number, number, number][][] = []
  for (let i = 0; i < stations; i++) {
    const t = i / (stations - 1)
    const z = STERN_Z + (BOW_Z - STERN_Z) * t
    const w = hullWidth(t)
    const d = 0.3 - 0.08 * t * t
    const sheer = 0.52 + 0.2 * t * t
    // One side, gunwale down to keel: [x, y].
    const side: [number, number][] = [
      [0.97 * w, sheer],
      [w, 0.2],
      [0.96 * w, -0.05],
      [0.82 * w, -0.45 * d],
      [0.48 * w, -0.85 * d],
      [0, -d],
    ]
    const ring = [
      ...side.map(([x, y]): [number, number, number] => [-x, y, z]),
      ...side
        .slice(0, -1)
        .reverse()
        .map(([x, y]): [number, number, number] => [x, y, z]),
    ]
    rings.push(ring)
  }
  const pos: number[] = []
  const idx: number[] = []
  const n = rings[0].length
  rings.forEach((ring) => ring.forEach((v) => pos.push(...v)))
  for (let i = 0; i < stations - 1; i++) {
    for (let j = 0; j < n - 1; j++) {
      const a = i * n + j
      const b = a + 1
      const c = a + n
      const d = c + 1
      idx.push(a, c, b, b, c, d)
    }
  }
  // Flat transom across the stern, with its own corners so it stays crisp.
  const base = pos.length / 3
  const stern = rings[0]
  const cy = stern.reduce((sum, v) => sum + v[1], 0) / n
  pos.push(0, cy, STERN_Z)
  stern.forEach((v) => pos.push(...v))
  for (let j = 0; j < n - 1; j++) idx.push(base, base + 1 + j, base + 2 + j)

  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  // Painted bottom below the waterline, white topsides above.
  const white = new Color('#F4F1EA')
  const paint = new Color(bottom)
  const c = new Color()
  const colors: number[] = []
  for (let i = 0; i < pos.length / 3; i++) {
    c.lerpColors(paint, white, Math.min(Math.max((pos[i * 3 + 1] - 0.02) / 0.12, 0), 1))
    colors.push(c.r, c.g, c.b)
  }
  g.setAttribute('color', new Float32BufferAttribute(colors, 3))
  g.computeVertexNormals()
  return g
}

function deckShape(): Shape {
  const s = new Shape()
  const steps = 16
  const pts: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 0.97
    pts.push([0.93 * hullWidth(t), -(STERN_Z + (BOW_Z - STERN_Z) * t)])
  }
  // Shape y is world -z once laid flat.
  s.moveTo(-pts[0][0], pts[0][1])
  pts.forEach(([x, y]) => s.lineTo(x, y))
  for (let i = pts.length - 1; i >= 0; i--) s.lineTo(-pts[i][0], pts[i][1])
  s.closePath()
  return s
}

/** Sail that billows to one side: a grid between the luff (mast side) and the leech, `belly` deep. */
function sailMesh(
  luffBottom: [number, number],
  luffTop: [number, number],
  clew: [number, number],
  belly: number,
): BufferGeometry {
  const cols = 5
  const rows = 7
  const pos: number[] = []
  const idx: number[] = []
  for (let r = 0; r < rows; r++) {
    const v = r / (rows - 1)
    // Luff point at this height, and leech point narrowing to the head.
    const ly = luffBottom[1] + (luffTop[1] - luffBottom[1]) * v
    const lz = luffBottom[0] + (luffTop[0] - luffBottom[0]) * v
    const ey = clew[1] + (luffTop[1] - clew[1]) * v
    const ez = clew[0] + (luffTop[0] - clew[0]) * v
    for (let c = 0; c < cols; c++) {
      const u = c / (cols - 1)
      pos.push(belly * Math.sin(Math.PI * u) * (1 - 0.8 * v), ly + (ey - ly) * u, lz + (ez - lz) * u)
    }
  }
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c
      idx.push(a, a + 1, a + cols, a + 1, a + cols + 1, a + cols)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

function useHullParts(bottom: string) {
  return useMemo(
    () => ({
      hull: hullGeometry(bottom),
      deck: deckShape(),
      hullMat: new MeshStandardMaterial({ vertexColors: true, roughness: 0.45, side: DoubleSide }),
    }),
    [bottom],
  )
}

function useSails() {
  return useMemo(
    () => ({
      // [z, y] corners: luff bottom, head, clew. Both sails billow to the same side.
      main: sailMesh([-0.2, 0.95], [-0.22, 3.25], [1.15, 0.98], 0.22),
      jib: sailMesh([-1.6, 0.68], [-0.3, 2.95], [-0.45, 0.8], 0.15),
    }),
    [],
  )
}

const WOOD = '#B98E5E'
const DARK_WOOD = '#6B4F3A'
const SAILCLOTH = '#FAF5E8'
const GLASS = '#2B3A42'

/** Hull, deck and rudder: shared by every boat. The hull below the waterline is painted `bottom`. */
function Hull({ bottom }: { bottom: string }) {
  const parts = useHullParts(bottom)
  return (
    <>
      <mesh geometry={parts.hull} material={parts.hullMat} castShadow />
      <mesh rotation-x={-Math.PI / 2} position-y={DECK_Y}>
        <shapeGeometry args={[parts.deck]} />
        <meshStandardMaterial color={WOOD} roughness={0.8} />
      </mesh>
      <mesh position={[0, -0.1, STERN_Z + 0.04]}>
        <boxGeometry args={[0.05, 0.5, 0.25]} />
        <meshStandardMaterial color={DARK_WOOD} />
      </mesh>
    </>
  )
}

function SailRig({ color }: { color: string }) {
  const parts = useSails()
  return (
    <>
      {/* Small cabin with portholes. */}
      <mesh position={[0, 0.6, -0.15]} castShadow>
        <boxGeometry args={[0.72, 0.3, 0.9]} />
        <meshStandardMaterial color="#F4F1EA" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.77, -0.15]}>
        <boxGeometry args={[0.62, 0.05, 0.8]} />
        <meshStandardMaterial color={WOOD} />
      </mesh>
      {[1, -1].flatMap((side) =>
        [-0.4, -0.1, 0.15].map((z) => (
          <mesh key={`${side}${z}`} position={[side * 0.365, 0.63, z]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.05, 0.05, 0.02, 8]} />
            <meshStandardMaterial color={GLASS} roughness={0.2} />
          </mesh>
        )),
      )}
      {/* Mast, boom, sails and flag. */}
      <mesh position={[0, 1.9, -0.25]} castShadow>
        <cylinderGeometry args={[0.035, 0.05, 2.9, 6]} />
        <meshStandardMaterial color={DARK_WOOD} />
      </mesh>
      <mesh position={[0, 0.93, 0.45]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.03, 0.03, 1.45, 5]} />
        <meshStandardMaterial color={DARK_WOOD} />
      </mesh>
      <mesh geometry={parts.main} castShadow>
        <meshStandardMaterial color={SAILCLOTH} side={DoubleSide} roughness={0.9} />
      </mesh>
      <mesh geometry={parts.jib} castShadow>
        <meshStandardMaterial color={SAILCLOTH} side={DoubleSide} roughness={0.9} />
      </mesh>
      <mesh position={[0, 3.3, -0.12]}>
        <boxGeometry args={[0.015, 0.16, 0.26]} />
        <meshStandardMaterial color={color} side={DoubleSide} />
      </mesh>
      {/* Tiller. */}
      <mesh position={[0, 0.55, 1.05]} rotation-x={-0.25}>
        <boxGeometry args={[0.04, 0.04, 0.55]} />
        <meshStandardMaterial color={DARK_WOOD} />
      </mesh>
    </>
  )
}

function FishingRig({ color }: { color: string }) {
  return (
    <>
      {/* Wheelhouse with windows and a coloured roof. */}
      <mesh position={[0, 0.85, 0.3]} castShadow>
        <boxGeometry args={[0.8, 0.75, 0.85]} />
        <meshStandardMaterial color="#F4F1EA" roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.27, 0.28]} castShadow>
        <boxGeometry args={[0.95, 0.08, 1.05]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 1.0, -0.13]} rotation-x={-0.15}>
        <boxGeometry args={[0.66, 0.26, 0.02]} />
        <meshStandardMaterial color={GLASS} roughness={0.15} />
      </mesh>
      {[1, -1].map((side) => (
        <mesh key={side} position={[side * 0.405, 1.0, 0.3]}>
          <boxGeometry args={[0.02, 0.24, 0.5]} />
          <meshStandardMaterial color={GLASS} roughness={0.15} />
        </mesh>
      ))}
      {/* Life ring on the side of the wheelhouse. */}
      <mesh position={[0.42, 0.8, 0.55]} rotation-y={Math.PI / 2}>
        <torusGeometry args={[0.13, 0.04, 6, 12]} />
        <meshStandardMaterial color="#E2574C" />
      </mesh>
      {/* Mast with a crossbar, and a fishing boom swung out over the stern. */}
      <mesh position={[0, 1.75, 0.4]}>
        <cylinderGeometry args={[0.025, 0.03, 0.9, 5]} />
        <meshStandardMaterial color={DARK_WOOD} />
      </mesh>
      <mesh position={[0, 2.0, 0.4]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.02, 0.02, 0.5, 4]} />
        <meshStandardMaterial color={DARK_WOOD} />
      </mesh>
      <mesh position={[0.3, 1.1, 1.05]} rotation={[0.9, 0, -0.5]}>
        <cylinderGeometry args={[0.02, 0.025, 1.4, 4]} />
        <meshStandardMaterial color={DARK_WOOD} />
      </mesh>
      {/* Crates on the back deck. */}
      <mesh position={[-0.2, 0.56, 1.0]}>
        <boxGeometry args={[0.28, 0.2, 0.28]} />
        <meshStandardMaterial color={WOOD} />
      </mesh>
    </>
  )
}

interface BoatDef {
  kind: 'sail' | 'fishing'
  radius: number
  speed: number
  start: number
  color: string
}

const BOATS: BoatDef[] = [
  { kind: 'sail', radius: 52, speed: 0.018, start: 1.2, color: '#C4523A' },
  { kind: 'fishing', radius: 58, speed: -0.012, start: 4.1, color: '#2F5E8A' },
]

function Boat({ def }: { def: BoatDef }) {
  const ref = useRef<Group>(null)

  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    const t = clock.elapsedTime
    const a = def.start + t * def.speed
    const x = def.radius * Math.cos(a)
    const z = def.radius * Math.sin(a)
    // Heading along the circle; the bow is local -z.
    const dir = Math.sign(def.speed)
    const vx = -Math.sin(a) * dir
    const vz = Math.cos(a) * dir
    const heading = Math.atan2(-vx, -vz)
    const h = waveHeight(x, z, t)
    // Tilt with the slope of the water under the boat.
    const e = 0.8
    const pitch = (waveHeight(x + vx * e, z + vz * e, t) - waveHeight(x - vx * e, z - vz * e, t)) / (2 * e)
    const roll = (waveHeight(x - vz * e, z + vx * e, t) - waveHeight(x + vz * e, z - vx * e, t)) / (2 * e)
    g.position.set(x, WATER_Y + h, z)
    g.rotation.set(pitch * 0.8, heading, roll * 0.8, 'YXZ')
  })

  return (
    <group ref={ref}>
      <Hull bottom={def.color} />
      {def.kind === 'sail' ? <SailRig color={def.color} /> : <FishingRig color={def.color} />}
    </group>
  )
}

// ---- Dolphins ----

const POD_SIZE = 3
const JUMP_TIME = 1.35
const JUMP_LENGTH = 5
const JUMP_HEIGHT = 2

interface Jump {
  active: boolean
  start: number
  x: number
  z: number
  dx: number
  dz: number
}

/** Smooth torpedo body with a beak, built by spinning a side profile. Dark back, pale belly. */
function dolphinBodyGeometry(): BufferGeometry {
  // [radius, position along the body], tail to beak tip.
  const profile: [number, number][] = [
    [0, -1.2],
    [0.05, -1.15],
    [0.08, -0.95],
    [0.15, -0.6],
    [0.25, -0.2],
    [0.3, 0.15],
    [0.3, 0.4],
    [0.26, 0.68],
    [0.2, 0.88],
    [0.12, 1.0],
    [0.07, 1.08],
    [0.055, 1.25],
    [0, 1.31],
  ]
  const g = new LatheGeometry(
    profile.map(([r, y]) => new Vector2(r, y)),
    14,
  )
  g.rotateX(Math.PI / 2) // length runs along +z, beak forward
  g.scale(0.85, 1, 1) // a little narrower than tall
  const back = new Color('#56748A')
  const belly = new Color('#DDE6EA')
  const c = new Color()
  const p = g.attributes.position
  const colors: number[] = []
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i)
    c.lerpColors(belly, back, Math.min(Math.max((y + 0.06) / 0.14, 0), 1))
    colors.push(c.r, c.g, c.b)
  }
  g.setAttribute('color', new Float32BufferAttribute(colors, 3))
  g.computeVertexNormals()
  return g
}

/** Flat fin from an outline in its own plane, `thick` deep and centered on that plane. */
function finGeometry(points: [number, number][], thick: number): BufferGeometry {
  const shape = new Shape(points.map(([x, y]) => new Vector2(x, y)))
  const g = new ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, curveSegments: 4 })
  g.translate(0, 0, -thick / 2)
  return g
}

function useDolphinParts() {
  return useMemo(() => {
    // Swept-back dorsal fin, drawn with x along the body (forward +) and y up.
    const dorsal = finGeometry(
      [
        [0.28, 0],
        [-0.2, 0],
        [-0.36, 0.36],
        [-0.26, 0.34],
        [-0.02, 0.18],
      ],
      0.05,
    )
    dorsal.rotateY(-Math.PI / 2)
    // Tail flukes, drawn with x sideways and y toward the back.
    const flukes = finGeometry(
      [
        [0, 0.06],
        [0.2, -0.04],
        [0.45, -0.18],
        [0.4, -0.3],
        [0.16, -0.2],
        [0, -0.12],
        [-0.16, -0.2],
        [-0.4, -0.3],
        [-0.45, -0.18],
        [-0.2, -0.04],
      ],
      0.035,
    )
    flukes.rotateX(Math.PI / 2)
    // Pectoral flipper, x sideways and y toward the back.
    const flipper = finGeometry(
      [
        [0, 0.1],
        [0.28, -0.12],
        [0.24, -0.2],
        [0, -0.08],
      ],
      0.03,
    )
    flipper.rotateX(Math.PI / 2)
    return {
      body: dolphinBodyGeometry(),
      dorsal,
      flukes,
      flipper,
      skin: new MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.05 }),
      fin: new MeshStandardMaterial({ color: '#4E6B80', roughness: 0.4, side: DoubleSide }),
      eye: new MeshStandardMaterial({ color: '#1A2228', roughness: 0.2 }),
    }
  }, [])
}

function Dolphin({ tail }: { tail: (g: Group | null) => void }) {
  const parts = useDolphinParts()
  return (
    <group scale={0.9}>
      <mesh geometry={parts.body} material={parts.skin} castShadow />
      <mesh geometry={parts.dorsal} material={parts.fin} position={[0, 0.27, -0.05]} castShadow />
      <mesh geometry={parts.flipper} material={parts.fin} position={[0.2, -0.14, 0.45]} rotation-z={-0.5} />
      <mesh
        geometry={parts.flipper}
        material={parts.fin}
        position={[-0.2, -0.14, 0.45]}
        rotation-z={0.5}
        scale-x={-1}
      />
      <group ref={tail} position-z={-1.12}>
        <mesh geometry={parts.flukes} material={parts.fin} castShadow />
      </group>
      {[1, -1].map((side) => (
        <mesh key={side} position={[side * 0.16, 0.06, 0.82]} material={parts.eye}>
          <sphereGeometry args={[0.03, 6, 4]} />
        </mesh>
      ))}
    </group>
  )
}

function Splash({ splashRef }: { splashRef: (m: Mesh | null) => void }) {
  const material = useMemo(() => new MeshBasicMaterial({ color: '#E8F6F8', transparent: true, opacity: 0 }), [])
  return (
    <mesh ref={splashRef} rotation-x={-Math.PI / 2} material={material} visible={false}>
      <ringGeometry args={[0.35, 0.6, 10]} />
    </mesh>
  )
}

/** A small pod of dolphins jumps near the player now and then, when there's open water in view. */
function Dolphins() {
  const bodies = useRef<(Group | null)[]>([])
  const tails = useRef<(Group | null)[]>([])
  const splashes = useRef<(Mesh | null)[]>([])
  const jumps = useMemo<Jump[]>(
    () => Array.from({ length: POD_SIZE }, () => ({ active: false, start: 0, x: 0, z: 0, dx: 0, dz: 0 })),
    [],
  )
  const next = useRef(4)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime

    if (t > next.current && jumps.every((j) => !j.active)) {
      next.current = t + 6 + Math.random() * 10
      const [fx, fz] = useGame.getState().focus
      for (let tries = 0; tries < 20; tries++) {
        const a = Math.random() * Math.PI * 2
        const d = 10 + Math.random() * 14
        const x = fx + Math.cos(a) * d
        const z = fz + Math.sin(a) * d * 0.7
        if (Math.hypot(x, z) < coastRadius(Math.atan2(z, x)) + 8) continue
        const heading = Math.random() * Math.PI * 2
        const dx = Math.cos(heading)
        const dz = Math.sin(heading)
        const count = 1 + Math.floor(Math.random() * POD_SIZE)
        for (let i = 0; i < count; i++) {
          const side = (i - (count - 1) / 2) * 1.4
          Object.assign(jumps[i], {
            active: true,
            start: t + i * 0.3 + Math.random() * 0.15,
            x: x - dz * side - dx * i * 0.8,
            z: z + dx * side - dz * i * 0.8,
            dx,
            dz,
          })
        }
        break
      }
    }

    jumps.forEach((j, i) => {
      const body = bodies.current[i]
      const inSplash = splashes.current[i * 2]
      const outSplash = splashes.current[i * 2 + 1]
      if (!body || !inSplash || !outSplash) return
      const u = (t - j.start) / JUMP_TIME
      if (!j.active || u < 0) {
        body.visible = false
        inSplash.visible = false
        outSplash.visible = false
        return
      }
      // Body: a hop out of the water, nose following the arc.
      const s = Math.min(u, 1)
      body.visible = u < 1
      body.position.set(
        j.x + j.dx * s * JUMP_LENGTH,
        WATER_Y - 0.5 + 4 * JUMP_HEIGHT * s * (1 - s),
        j.z + j.dz * s * JUMP_LENGTH,
      )
      const climb = (4 * JUMP_HEIGHT * (1 - 2 * s)) / JUMP_LENGTH
      body.rotation.set(-Math.atan(climb), Math.atan2(j.dx, j.dz), 0, 'YXZ')
      // Tail beats as it leaves the water, then trails behind.
      const tail = tails.current[i]
      if (tail) tail.rotation.x = Math.sin(t * 14) * 0.35 * Math.max(0, 1 - s * 2.5)
      // Splashes where it leaves and re-enters the water.
      const ring = (m: Mesh, age: number, x: number, z: number) => {
        const k = age / 0.7
        m.visible = k >= 0 && k < 1
        if (!m.visible) return
        m.position.set(x, WATER_Y + 0.15, z)
        m.scale.setScalar(0.6 + k * 2.2)
        ;(m.material as MeshBasicMaterial).opacity = 0.85 * (1 - k)
      }
      const t0 = t - j.start
      ring(inSplash, t0 - 0.05, j.x + j.dx * 0.6, j.z + j.dz * 0.6)
      ring(outSplash, t0 - JUMP_TIME * 0.92, j.x + j.dx * JUMP_LENGTH * 0.95, j.z + j.dz * JUMP_LENGTH * 0.95)
      if (t0 > JUMP_TIME + 0.8) j.active = false
    })
  })

  return (
    <>
      {jumps.map((_, i) => (
        <group key={i} ref={(g) => void (bodies.current[i] = g)} visible={false}>
          <Dolphin tail={(g) => void (tails.current[i] = g)} />
        </group>
      ))}
      {Array.from({ length: POD_SIZE * 2 }, (_, i) => (
        <Splash key={i} splashRef={(m) => void (splashes.current[i] = m)} />
      ))}
    </>
  )
}

// ---- Sailboats off the Welcome Zone ----
// The game starts at the Welcome Zone, so a few small sailboats drift back and forth
// just past its beach, where the camera can see them.

const SAILBOATS = ['#E2574C', '#F2C14E', '#3C8DD9']
/** Each boat keeps its own lane, along x, between these distances out (z), so they never collide. */
const LANE_NEAR = 41.6
const LANE_FAR = 43.6
const RUN_HALF = 34

interface Run {
  start: number
  z: number
  dir: 1 | -1
  speed: number
}

function newRun(t: number, lane: number, alreadyOut = 0): Run {
  const speed = 1.6 + Math.random() * 1.2
  return {
    // `alreadyOut` starts the boat partway across, so some are in view right away.
    start: t - alreadyOut / speed,
    z: lane,
    dir: Math.random() < 0.5 ? 1 : -1,
    speed,
  }
}

function SailBoat({ color, index }: { color: string; index: number }) {
  const ref = useRef<Group>(null)
  const run = useRef<Run | null>(null)
  const next = useRef(0)
  const lane = LANE_NEAR + ((LANE_FAR - LANE_NEAR) * index) / (SAILBOATS.length - 1)

  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    const t = clock.elapsedTime
    if (!run.current && t > next.current) {
      // First trip: spread the boats out across the view.
      run.current = newRun(t, lane, next.current === 0 ? RUN_HALF * (0.4 + index * 0.45) : 0)
    }
    const r = run.current
    g.visible = !!r
    if (!r) return
    const d = (t - r.start) * r.speed
    if (d > RUN_HALF * 2) {
      run.current = null
      next.current = t + 2 + Math.random() * 6
      return
    }
    const x = r.dir * (d - RUN_HALF)
    // A lazy weave so they don't run on rails.
    const z = r.z + Math.sin(d * 0.1 + index) * 0.25
    const dz = Math.cos(d * 0.1 + index) * 0.025
    g.position.set(x, WATER_Y + waveHeight(x, z, t), z)
    // Bow (-z) faces the direction of travel, heeling a little in the wind and rocking gently.
    g.rotation.set(
      Math.sin(t * 1.3 + index) * 0.04,
      Math.atan2(-r.dir, -dz * r.dir),
      0.08 + Math.sin(t * 1.1 + index * 2) * 0.05,
      'YXZ',
    )
  })

  return (
    <group ref={ref} visible={false}>
      <group scale={0.75}>
        <Hull bottom={color} />
        <SailRig color={color} />
      </group>
    </group>
  )
}

export function Ocean() {
  return (
    <group>
      <Water />
      {BOATS.map((def, i) => (
        <Boat key={i} def={def} />
      ))}
      {SAILBOATS.map((color, i) => (
        <SailBoat key={color} color={color} index={i} />
      ))}
      <Dolphins />
    </group>
  )
}

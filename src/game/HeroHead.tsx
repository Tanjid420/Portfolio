import { useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BufferGeometry,
  Group,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three'
import { Kit, rod, type V3 } from './kit'

// The hero's head: a shaped face with eyes, brows, nose, lips and ears, a short textured haircut
// with a quiff, and red-tinted glasses. Everything is merged into four meshes so it stays light on phones.
// Built facing +z, centred on the middle of the head.

/** Half-sizes of the head: width, height, depth. */
const A = 0.239
const B = 0.273
const C = 0.247

const COLORS = {
  skin: '#E8B98F',
  skinShade: '#D49E74',
  earInner: '#C98F68',
  nostril: '#7A4A35',
  blush: '#E9A48A',
  lipBottom: '#C9776B',
  mouth: '#6E2E2A',
  eyeWhite: '#F5F2EE',
  iris: '#5A3A22',
  pupil: '#111111',
  lash: '#1E1410',
  hair: '#2A1C14',
  hairLight: '#4A3424',
  hairDark: '#20150F',
  frame: '#141618',
  lens: '#0D0E10',
}

/** How far forward the face is at (x, y): the front of the head's ellipsoid. */
const faceZ = (x: number, y: number) => C * Math.sqrt(Math.max(0, 1 - (x / A) ** 2 - (y / B) ** 2))

/** An egg-shaped head with a narrower jaw, a little chin and slightly flat temples. */
function headGeometry(): BufferGeometry {
  const g = new SphereGeometry(1, 40, 28)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i)
    const y = p.getY(i)
    let z = p.getZ(i)
    if (y < 0) {
      const t = -y
      x *= 1 - 0.2 * t * t
      if (z > 0) z *= 1 - 0.06 * t
    }
    if (y < -0.55 && z > 0.3) z += 0.06 * (-y - 0.55) * z
    x *= 1 - 0.04 * Math.max(0, y)
    p.setXYZ(i, x * A, y * B, z * C)
  }
  g.computeVertexNormals()
  return g
}

/** Radius of each round lens. */
const LENS_R = 0.068
/** Lens centres sit in front of the eyes, angled to follow the face. */
const LENS_AT = (s: number): V3 => [s * 0.088, 0.01, 0.262]
/** Lenses lean back by this much, to face the camera above. */
const LENS_TILT = 0.56

/** Point on the head's surface at polar angle `theta` (0 = top) and turn `phi` (0 = face front), `lift` times out. */
function headPoint(theta: number, phi: number, lift = 1) {
  return new Vector3(
    Math.sin(theta) * Math.sin(phi) * A * lift,
    Math.cos(theta) * B * lift,
    Math.sin(theta) * Math.cos(phi) * C * lift,
  )
}

const deg = (d: number) => (d * Math.PI) / 180

function buildFace(kit: Kit) {
  kit.add(headGeometry(), COLORS.skin)
  // Ears with an inner fold.
  for (const s of [-1, 1]) {
    kit.ball(0.06, [s * 0.232, -0.005, -0.005], COLORS.skinShade, { scale: [0.35, 1, 0.68] })
    kit.ball(0.035, [s * 0.249, -0.005, 0.002], COLORS.earInner, { scale: [0.25, 0.7, 0.45] })
  }
  // Nose: bridge, rounded tip, the wings either side, and nostrils.
  kit.ball(0.022, [0, -0.008, faceZ(0, -0.008) + 0.002], COLORS.skin, { scale: [0.75, 2, 0.9] })
  kit.ball(0.027, [0, -0.058, 0.262], COLORS.skin)
  for (const s of [-1, 1]) {
    kit.ball(0.017, [s * 0.022, -0.064, 0.25], COLORS.skinShade)
    kit.ball(0.008, [s * 0.013, -0.074, 0.258], COLORS.nostril)
  }
  // Eyes: white, iris, pupil, a highlight and a lash line over the top.
  for (const s of [-1, 1]) {
    const x = s * 0.075
    const z = faceZ(x, 0.018)
    kit.ball(0.036, [x, 0.018, z - 0.008], COLORS.eyeWhite, { scale: [1, 0.62, 0.42] })
    kit.ball(0.017, [x, 0.016, z + 0.006], COLORS.iris, { scale: [1, 1, 0.5] })
    kit.ball(0.009, [x, 0.016, z + 0.013], COLORS.pupil, { scale: [1, 1, 0.5] })
    kit.ball(0.005, [x - s * 0.006, 0.024, z + 0.016], '#FFFFFF')
    const lash = new TorusGeometry(0.034, 0.005, 6, 12, Math.PI)
    lash.scale(1, 0.62, 1)
    kit.add(lash, COLORS.lash, [x, 0.02, z - 0.002])
    // Eyebrow: a gentle arch above the glasses.
    const brow: V3[] = [
      [s * 0.035, 0.09, faceZ(0.035, 0.09) + 0.006],
      [s * 0.078, 0.104, faceZ(0.078, 0.104) + 0.006],
      [s * 0.115, 0.09, faceZ(0.115, 0.09) + 0.004],
    ]
    kit.add(rod(brow[0], brow[1], 0.012, 0.011, 6), COLORS.hair)
    kit.add(rod(brow[1], brow[2], 0.011, 0.007, 6), COLORS.hair)
    kit.ball(0.011, brow[1], COLORS.hair)
    // A touch of warmth on the cheeks.
    kit.ball(0.03, [s * 0.12, -0.06, faceZ(0.12, -0.06) - 0.012], COLORS.blush, { scale: [1, 0.6, 0.35] })
  }
  // A friendly smile: a curved line with a hint of lower lip under it.
  const smile = new TorusGeometry(0.036, 0.0065, 6, 14, Math.PI)
  smile.rotateZ(Math.PI)
  kit.add(smile, COLORS.mouth, [0, -0.1, 0.222])
  kit.ball(0.02, [0, -0.146, 0.216], COLORS.lipBottom, { scale: [1.3, 0.32, 0.4] })
}

/** Scalp under the big hair: covers the top and back down to just above the ears, plus sideburns. */
function buildHairBase(kit: Kit) {
  const cap = new SphereGeometry(1, 36, 18, 0, Math.PI * 2, 0, 1.6)
  cap.scale(A * 1.06, B * 1.06, C * 1.06)
  cap.rotateX(-0.66)
  cap.translate(0, 0.012, -0.008)
  kit.add(cap, COLORS.hair)
  for (const s of [-1, 1])
    kit.box([0.022, 0.075, 0.03], [s * 0.222, 0.01, 0.07], COLORS.hairDark, { rot: [0, s * 0.9, 0] })
}

/**
 * One lock of hair, growing along +y from its root at the origin: thick at the root, tapering to a
 * soft point, and curling down toward the scalp (-z) so long locks hug the head.
 */
function lockGeometry(length: number, width: number, curl: number): BufferGeometry {
  const g = new SphereGeometry(1, 12, 10)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) + 1) / 2
    const w = (width / 2) * (1 - 0.65 * t ** 1.5)
    const thick = 0.03 * (1 - 0.5 * t)
    p.setXYZ(i, p.getX(i) * w, t * length, p.getZ(i) * thick + 0.012 - curl * t * t * length * 0.6)
  }
  g.computeVertexNormals()
  return g
}

interface Clump {
  /** Root on the head, as polar angle (0 = top) and turn (0 = face front), in degrees for the turn. */
  root: [number, number]
  /** Where the clump heads to, same units. */
  toward: [number, number]
  length: number
  width: number
}

// Parted on the hero's right (-x): big locks sweep from the part over the top to the left,
// a fringe crosses the forehead, the back falls to the nape, and the part side stays short.
const PART = -35
const CLUMPS: Clump[] = [
  { root: [0.22, PART], toward: [0.95, 60], length: 0.33, width: 0.2 },
  { root: [0.5, PART], toward: [1.0, 50], length: 0.35, width: 0.2 },
  { root: [0.7, PART + 5], toward: [1.0, 45], length: 0.25, width: 0.17 },
  { root: [0.85, PART - 5], toward: [1.3, 85], length: 0.31, width: 0.18 },
  { root: [0.55, 180], toward: [1.6, 180], length: 0.31, width: 0.21 },
  { root: [0.75, 135], toward: [1.6, 120], length: 0.27, width: 0.19 },
  { root: [0.75, -135], toward: [1.6, -120], length: 0.27, width: 0.19 },
  { root: [0.55, PART - 10], toward: [1.2, -90], length: 0.2, width: 0.16 },
  { root: [1.0, 95], toward: [1.45, 105], length: 0.18, width: 0.16 },
  { root: [1.05, -100], toward: [1.45, -100], length: 0.15, width: 0.14 },
]

/** Where a clump sits and how it's turned: y along the hair, z out of the scalp. */
function clumpFrame(c: Clump) {
  const [rt, rp] = c.root
  const [tt, tp] = c.toward
  const root = headPoint(rt, deg(rp), 1.04)
  const n = new Vector3(Math.sin(rt) * Math.sin(deg(rp)), Math.cos(rt), Math.sin(rt) * Math.cos(deg(rp))).normalize()
  const to = headPoint(tt, deg(tp), 1.04).sub(root)
  const y = to.addScaledVector(n, -to.dot(n)).normalize()
  const x = new Vector3().crossVectors(y, n).normalize()
  const z = new Vector3().crossVectors(x, y)
  return { position: root, quaternion: new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z)) }
}

/** Three locks side by side, one lighter, so the clump reads as hair. */
function clumpGeometry(c: Clump, i: number): BufferGeometry {
  const kit = new Kit()
  const locks: [number, number, string][] = [
    [-0.3, 0.9, COLORS.hair],
    [0, 1, i % 2 ? COLORS.hairLight : COLORS.hair],
    [0.3, 0.85, i % 2 ? COLORS.hair : COLORS.hairLight],
  ]
  for (const [side, len, color] of locks) {
    kit.add(lockGeometry(c.length * len, c.width * 0.55, 0.5), color, [side * c.width, 0, 0], {
      rot: [0, 0, -side * 0.25],
    })
  }
  return kit.build().main!
}

/** Round sunglasses have no visible rims: just a hairline bridge and arms to hold them, and glints on the lenses. */
function buildFrame(kit: Kit) {
  for (const s of [-1, 1]) {
    // Temple arm back to the ear, then down behind it.
    kit.add(rod([s * 0.148, 0.02, 0.236], [s * 0.238, 0.035, 0.02], 0.004, 0.004, 5), COLORS.frame)
    kit.add(rod([s * 0.238, 0.035, 0.02], [s * 0.232, -0.005, -0.06], 0.004, 0.004, 5), COLORS.frame)
    // Glints on the lens front, laid on its tilted face: up the lens is also back (-z).
    const [lx, ly, lz] = LENS_AT(s)
    const onLens = (side: number, up: number): V3 => [
      lx + side,
      ly + up * Math.cos(LENS_TILT) + 0.006 * Math.sin(LENS_TILT),
      lz - up * Math.sin(LENS_TILT) + 0.006 * Math.cos(LENS_TILT),
    ]
    kit.box([0.014, 0.046, 0.002], onLens(-s * 0.026, 0.018), '#FFFFFF', { rot: [-LENS_TILT, 0, s * 0.6] })
    kit.ball(0.01, onLens(-s * 0.002, 0.042), '#FFFFFF')
  }
  // Thin bridge over the nose.
  kit.add(rod([-0.022, 0.02, 0.27], [0, 0.026, 0.274], 0.004, 0.004, 5), COLORS.frame)
  kit.add(rod([0, 0.026, 0.274], [0.022, 0.02, 0.27], 0.004, 0.004, 5), COLORS.frame)
}

/**
 * Two flat, perfectly round black lenses. They tilt back toward the high game camera,
 * so on screen they look like full circles rather than ovals.
 */
function buildLenses(kit: Kit) {
  for (const s of [-1, 1])
    kit.cyl(LENS_R, 0.008, LENS_AT(s), COLORS.lens, { sides: 40, rot: [Math.PI / 2 - LENS_TILT, 0, 0] })
}

const MATS = {
  skin: new MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }),
  hair: new MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }),
  frame: new MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.2 }),
  // Black lenses with a soft sheen.
  lens: new MeshStandardMaterial({ vertexColors: true, roughness: 0.2, metalness: 0.4 }),
}

/** How the hero is moving, read each frame to make the hair flow. */
export interface HeadMotion {
  /** 0 standing still, 1 running. */
  walk: number
  /** Stride phase, advancing with distance covered. */
  phase: number
}

/**
 * The hero's head. Big for the body (chibi style) and tipped up so the face shows to the high camera.
 * The hair clumps lift and bounce while running, and sway gently when standing.
 */
export function HeroHead({ motion }: { motion: RefObject<HeadMotion> }) {
  const parts = useMemo(() => {
    const build = (fn: (k: Kit) => void) => {
      const k = new Kit()
      fn(k)
      return k.build().main!
    }
    return {
      face: build(buildFace),
      hairBase: build(buildHairBase),
      frame: build(buildFrame),
      lenses: build(buildLenses),
      clumps: CLUMPS.map((c, i) => ({ ...clumpFrame(c), geometry: clumpGeometry(c, i) })),
    }
  }, [])
  const swing = useRef<(Group | null)[]>([])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const { walk, phase } = motion.current
    swing.current.forEach((g, i) => {
      if (!g) return
      // Lifted by the run's "wind", bouncing with each stride; a slow sway at rest.
      g.rotation.x = 0.04 + walk * (0.2 + 0.22 * Math.sin(phase * 1.4 + i * 0.8)) + 0.03 * Math.sin(t * 1.7 + i)
      g.rotation.z = walk * 0.2 * Math.sin(phase * 0.8 + i * 1.3) + 0.02 * Math.sin(t * 1.3 + i)
      g.rotation.y = walk * 0.12 * Math.sin(phase * 1.1 + i * 2.1)
    })
  })

  return (
    <group position-y={1.97} rotation-x={-0.4} scale={1.22}>
      <mesh geometry={parts.face} material={MATS.skin} castShadow />
      <mesh geometry={parts.hairBase} material={MATS.hair} castShadow />
      {parts.clumps.map((c, i) => (
        <group key={i} position={c.position} quaternion={c.quaternion}>
          <group ref={(g) => void (swing.current[i] = g)}>
            <mesh geometry={c.geometry} material={MATS.hair} castShadow />
          </group>
        </group>
      ))}
      <mesh geometry={parts.frame} material={MATS.frame} />
      <mesh geometry={parts.lenses} material={MATS.lens} />
    </group>
  )
}

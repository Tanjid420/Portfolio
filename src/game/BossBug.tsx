import { useMemo, type RefObject } from 'react'
import {
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  MeshStandardMaterial,
  Quaternion,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Mats } from './Bugs'

// The boss: a big, detailed ladybug in office wear with curved horns.
// When the player walks into its zone, its wing cases lift and the wings underneath buzz.
// Faces +z, same size and footprint as the normal bug model, so the bug code can scale and move it the same way.

export interface BossParts {
  /** Wing cases (the red shell halves), [right, left]. */
  cases: (Group | null)[]
  /** Flying wings under the cases, [right, left]. */
  wings: (Group | null)[]
}

const UP = new Vector3(0, 1, 0)

/** Tapered rod from a to b (radius r1 at a, r2 at b). */
function rod(a: Vector3, b: Vector3, r1: number, r2: number): BufferGeometry {
  const dir = b.clone().sub(a)
  const g = new CylinderGeometry(r2, r1, dir.length(), 10)
  g.translate(0, dir.length() / 2, 0)
  g.applyQuaternion(new Quaternion().setFromUnitVectors(UP, dir.normalize()))
  g.translate(a.x, a.y, a.z)
  return g
}

/** A curved, tapering horn along `points`, with balls at the joints so it bends smoothly. */
function hornGeometry(points: [number, number, number][], r0: number, r1: number): BufferGeometry {
  const pts = points.map((p) => new Vector3(...p))
  const parts: BufferGeometry[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const ra = r0 + ((r1 - r0) * i) / (pts.length - 1)
    const rb = r0 + ((r1 - r0) * (i + 1)) / (pts.length - 1)
    parts.push(rod(pts[i], pts[i + 1], ra, rb))
    if (i > 0) {
      const joint = new SphereGeometry(ra, 10, 6)
      joint.translate(pts[i].x, pts[i].y, pts[i].z)
      parts.push(joint)
    }
  }
  // Drop uv/normal differences between part types before merging.
  return mergeGeometries(parts.map((g) => g.toNonIndexed()))!
}

// Right horn: sweeps up and out from the head, then curls back in at the tip. The left one is mirrored.
const HORN: [number, number, number][] = [
  [0.1, 0.4, 0.52],
  [0.2, 0.55, 0.56],
  [0.3, 0.72, 0.56],
  [0.33, 0.88, 0.5],
  [0.28, 1.0, 0.42],
]
// Dark tip continues from the last horn point.
const HORN_TIP: [number, number, number][] = [
  [0.28, 1.0, 0.42],
  [0.22, 1.07, 0.36],
]

/** Flying wing: long and thin, laid flat, pointing out and back. Drawn with x outward, y backward. */
function wingShape(): Shape {
  const s = new Shape()
  s.moveTo(0, 0.05)
  s.bezierCurveTo(0.35, 0.12, 0.8, 0.0, 1.0, -0.3)
  s.bezierCurveTo(1.05, -0.5, 0.75, -0.55, 0.45, -0.42)
  s.bezierCurveTo(0.25, -0.32, 0.05, -0.18, 0, -0.08)
  s.closePath()
  return s
}

// Spots on each case, as [sideways angle, forward angle] on the shell. More than the small bugs.
const SPOT_DIRS: [number, number][] = [
  [0.5, 0.6],
  [0.85, 0.15],
  [0.4, -0.15],
  [0.8, -0.55],
  [0.35, -0.8],
]

function shellPoint(side: number, across: number, along: number): [number, number, number] {
  const x = Math.sin(across) * Math.cos(along) * side
  const y = Math.cos(across) * Math.cos(along)
  const z = Math.sin(along)
  return [x * 0.46, 0.3 + y * 0.46 * 0.6, z * 0.46 * 1.15]
}

/** Hinge for each wing case, at its front inner corner. */
const HINGE: [number, number, number] = [0.03, 0.44, 0.32]

function useBossParts() {
  return useMemo(() => {
    const wing = new ShapeGeometry(wingShape(), 12)
    wing.rotateX(Math.PI / 2) // shape y (backward) becomes -z
    // Veins: a few thin rods along the wing.
    const veins = mergeGeometries(
      [
        rod(new Vector3(0, 0, 0), new Vector3(0.95, 0, 0.3), 0.008, 0.004),
        rod(new Vector3(0.05, 0, 0.05), new Vector3(0.6, 0, 0.42), 0.007, 0.003),
        rod(new Vector3(0.4, 0, 0.16), new Vector3(0.7, 0, 0.45), 0.005, 0.003),
      ].map((g) => g.toNonIndexed()),
    )!
    return {
      horn: hornGeometry(HORN, 0.075, 0.03),
      hornTip: hornGeometry(HORN_TIP, 0.03, 0.006),
      wing,
      veins,
      shell: new MeshStandardMaterial({ color: '#D9452B', roughness: 0.18, metalness: 0.15 }),
      horn_: new MeshStandardMaterial({ color: '#EDE3CC', roughness: 0.35 }),
      hornDark: new MeshStandardMaterial({ color: '#4A3A2A', roughness: 0.4 }),
      membrane: new MeshStandardMaterial({
        color: '#E9D9B8',
        transparent: true,
        opacity: 0.55,
        roughness: 0.2,
        side: DoubleSide,
        depthWrite: false,
      }),
      vein: new MeshStandardMaterial({ color: '#6B4F3A', roughness: 0.6 }),
      white: new MeshStandardMaterial({ color: '#F4F1EA', roughness: 0.5 }),
      iris: new MeshStandardMaterial({ color: '#E0202E', roughness: 0.3, emissive: '#600008' }),
      shirt: new MeshStandardMaterial({ color: '#F4F1EA', roughness: 0.6 }),
    }
  }, [])
}

/** One leg in two parts, thigh and shin with a little foot. Pivots where it meets the body. */
function BossLeg({ legRef, x, z, mats }: { legRef: (g: Group | null) => void; x: number; z: number; mats: Mats }) {
  const side = Math.sign(x)
  return (
    <group ref={legRef} position={[x, 0.2, z]}>
      <mesh position={[side * 0.1, 0.02, 0]} rotation-z={side * -1.25} material={mats.body}>
        <cylinderGeometry args={[0.03, 0.026, 0.22, 6]} />
      </mesh>
      <mesh position={[side * 0.23, -0.08, 0]} rotation-z={side * 0.55} material={mats.body}>
        <cylinderGeometry args={[0.024, 0.016, 0.26, 6]} />
      </mesh>
      <mesh position={[side * 0.29, -0.2, 0.02]} scale={[1, 0.5, 1.6]} material={mats.body}>
        <sphereGeometry args={[0.025, 6, 4]} />
      </mesh>
    </group>
  )
}

export function BossModel({
  mats,
  legs,
  boss,
}: {
  mats: Mats
  legs: RefObject<(Group | null)[]>
  boss: RefObject<BossParts>
}) {
  const p = useBossParts()
  return (
    <>
      {/* Dark body underneath */}
      <mesh position-y={0.28} scale={[0.95, 0.55, 1.1]} material={mats.body} castShadow>
        <sphereGeometry args={[0.42, 20, 12]} />
      </mesh>

      {/* Wing cases: glossy red halves with spots, hinged at the front so they can lift */}
      {[1, -1].map((s, si) => (
        <group key={s} ref={(g) => void (boss.current.cases[si] = g)} position={[s * HINGE[0], HINGE[1], HINGE[2]]}>
          <group position={[-s * HINGE[0], -HINGE[1], -HINGE[2]]}>
            <mesh position={[s * 0.025, 0.3, 0]} scale={[1, 0.6, 1.15]} material={p.shell} castShadow>
              <sphereGeometry args={[0.46, 24, 14, s > 0 ? Math.PI / 2 : -Math.PI / 2, Math.PI, 0, Math.PI / 2]} />
            </mesh>
            {SPOT_DIRS.map(([across, along], i) => (
              <mesh key={i} position={shellPoint(s, across, along)} scale={[1, 0.45, 1]} material={mats.spot}>
                <sphereGeometry args={[i === 0 ? 0.08 : 0.065, 10, 6]} />
              </mesh>
            ))}
          </group>
        </group>
      ))}

      {/* Flying wings, folded away (scaled to nothing) until the cases open */}
      {[1, -1].map((s, si) => (
        <group key={s} scale-x={s}>
          <group ref={(g) => void (boss.current.wings[si] = g)} position={[0.08, 0.5, 0.22]} scale={0.001}>
            <mesh geometry={p.wing} material={p.membrane} />
            <mesh geometry={p.veins} material={p.vein} />
          </group>
        </group>
      ))}

      {/* Shield behind the head: black with the two white patches real ladybugs have */}
      <mesh position={[0, 0.38, 0.42]} scale={[1, 0.5, 0.55]} material={mats.body} castShadow>
        <sphereGeometry args={[0.27, 18, 10]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.15, 0.44, 0.47]} scale={[0.8, 0.35, 0.6]} material={p.white}>
          <sphereGeometry args={[0.09, 10, 6]} />
        </mesh>
      ))}

      {/* Head */}
      <mesh position={[0, 0.27, 0.56]} material={mats.body} castShadow>
        <sphereGeometry args={[0.22, 18, 12]} />
      </mesh>

      {/* Angry eyes: white, red iris, black pupil, a glint, and heavy brows */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.1, 0.35, 0.69]}>
          <mesh material={mats.eye}>
            <sphereGeometry args={[0.075, 14, 10]} />
          </mesh>
          <mesh position={[0, -0.005, 0.045]} scale={[1, 1, 0.6]} material={p.iris}>
            <sphereGeometry args={[0.042, 10, 8]} />
          </mesh>
          <mesh position={[0, -0.005, 0.068]} material={mats.body}>
            <sphereGeometry args={[0.02, 8, 6]} />
          </mesh>
          <mesh position={[s * -0.015, 0.02, 0.072]} material={mats.eye}>
            <sphereGeometry args={[0.009, 6, 4]} />
          </mesh>
          <mesh position={[0, 0.075, 0.03]} rotation-z={s * 0.45} material={mats.body}>
            <boxGeometry args={[0.13, 0.03, 0.04]} />
          </mesh>
        </group>
      ))}

      {/* Mandibles */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.06, 0.17, 0.74]} rotation={[Math.PI / 2, 0, s * 0.5]} material={p.hornDark}>
          <coneGeometry args={[0.025, 0.1, 6]} />
        </mesh>
      ))}

      {/* Big curved horns, ivory with dark tips; the left is the right mirrored */}
      {[1, -1].map((s) => (
        <group key={s} scale-x={s}>
          <mesh geometry={p.horn} material={p.horn_} castShadow />
          <mesh geometry={p.hornTip} material={p.hornDark} />
        </group>
      ))}

      {/* Antennae with beaded segments and a club tip */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.07, 0.42, 0.66]} rotation={[0.7, 0, s * -0.35]}>
          <mesh position-y={0.12} material={mats.body}>
            <cylinderGeometry args={[0.012, 0.014, 0.24, 5]} />
          </mesh>
          {[0.06, 0.13, 0.2].map((y) => (
            <mesh key={y} position-y={y} material={mats.body}>
              <sphereGeometry args={[0.02, 6, 4]} />
            </mesh>
          ))}
          <mesh position-y={0.27} scale={[1, 1.4, 1]} material={mats.body}>
            <sphereGeometry args={[0.035, 8, 6]} />
          </mesh>
        </group>
      ))}

      {/* Office wear: shirt collar, tie knot and a long tie */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.06, 0.15, 0.7]} rotation={[0.3, s * 0.5, s * 0.6]} material={p.shirt}>
          <boxGeometry args={[0.09, 0.05, 0.015]} />
        </mesh>
      ))}
      <mesh position={[0, 0.13, 0.72]} material={mats.tie}>
        <boxGeometry args={[0.05, 0.05, 0.04]} />
      </mesh>
      <mesh position={[0, 0.02, 0.71]} rotation={[0.25, Math.PI / 4, 0]} scale={[1, 1, 0.5]} material={mats.tie}>
        <coneGeometry args={[0.06, 0.2, 4]} />
      </mesh>

      {/* Legs: three per side */}
      {[-1, 1].flatMap((s, si) =>
        [0.25, 0, -0.25].map((z, i) => (
          <BossLeg
            key={`${s}-${i}`}
            x={s * 0.32}
            z={z}
            mats={mats}
            legRef={(g) => {
              legs.current[si * 3 + i] = g
            }}
          />
        )),
      )}
    </>
  )
}

/**
 * Opens the wing cases and buzzes the wings. `open` runs 0 (folded) to 1 (fully open).
 * Returns how high the body should hover.
 */
export function animateBoss(parts: BossParts, open: number, t: number): number {
  const e = open * open * (3 - 2 * open)
  parts.cases.forEach((g, i) => {
    if (!g) return
    const s = i === 0 ? 1 : -1
    // Lift the back edge up, and swing the halves apart.
    g.rotation.set(0.75 * e, -s * 0.35 * e, s * 0.55 * e)
  })
  parts.wings.forEach((g) => {
    if (!g) return
    g.scale.setScalar(Math.max(e, 0.001))
    g.rotation.z = (0.25 + Math.sin(t * 38) * 0.55) * e
  })
  return e * (0.25 + Math.sin(t * 6) * 0.05)
}

import { useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from 'three'
import { BUG_SPECS, BUGS, startMotion, stepBug, zoneOf, type BugDef, type BugKind } from './bugs'
import { SWING_TIME } from './Player'
import { useGame } from './store'

/** The net is on its way down between these points of the swing. */
export const NET_DOWN_FROM = 0.3
export const NET_DOWN_TO = 0.55
/** Length of the catch animation, in seconds. */
const CATCH_TIME = 0.9

const SHELL: Record<BugKind, string> = { normal: '#FF7452', golden: '#F2C14E', boss: '#D9452B' }
const SPOTS: Record<BugKind, string> = { normal: '#1A1A1A', golden: '#7A5410', boss: '#1A1A1A' }

/** Distance from (x, z) to the line segment a-b on the ground. */
export function distToSegment(x: number, z: number, a: [number, number], b: [number, number]) {
  const [ax, az] = a
  const abx = b[0] - ax
  const abz = b[1] - az
  const len2 = abx * abx + abz * abz || 1
  const t = Math.max(0, Math.min(1, ((x - ax) * abx + (z - az) * abz) / len2))
  return Math.hypot(x - (ax + abx * t), z - (az + abz * t))
}

export type Mats = ReturnType<typeof makeMats>

function makeMats(kind: BugKind) {
  const m = (color: string, roughness = 0.6) => new MeshStandardMaterial({ color, roughness })
  return {
    shell:
      kind === 'golden'
        ? new MeshStandardMaterial({ color: SHELL.golden, roughness: 0.3, metalness: 0.4, emissive: '#F2C14E', emissiveIntensity: 0.3 })
        : m(SHELL[kind], 0.4),
    spot: m(SPOTS[kind]),
    body: m('#1A1A1A', 0.8),
    eye: m('#FFFFFF', 0.3),
    horn: m('#E4EDE6', 0.5),
    tie: m('#3E7BE0', 0.6),
  }
}

// Spots on each wing, as [sideways angle, forward angle] on the shell.
const SPOT_DIRS: [number, number][] = [
  [0.55, 0.55],
  [0.8, -0.1],
  [0.45, -0.75],
]

/** Point on the shell ellipsoid in a given direction. */
function shellPoint(side: number, across: number, along: number): [number, number, number] {
  const x = Math.sin(across) * Math.cos(along) * side
  const y = Math.cos(across) * Math.cos(along)
  const z = Math.sin(along)
  return [x * 0.46, 0.3 + y * 0.46 * 0.6, z * 0.46 * 1.15]
}

/** One leg, pivoting where it meets the body. */
function Leg({ legRef, x, z, mats }: { legRef: (g: Group | null) => void; x: number; z: number; mats: Mats }) {
  const side = Math.sign(x)
  return (
    <group ref={legRef} position={[x, 0.18, z]}>
      <mesh position={[side * 0.16, -0.06, 0]} rotation-z={side * 1.15} material={mats.body}>
        <cylinderGeometry args={[0.025, 0.02, 0.36, 5]} />
      </mesh>
    </group>
  )
}

/** Cute ladybug facing +z. Golden bugs shine, the boss has horns and a tie. */
export function BugModel({ kind, mats, legs }: { kind: BugKind; mats: Mats; legs: RefObject<(Group | null)[]> }) {
  return (
    <>
      {/* Dark body underneath, shows as the line between the wings */}
      <mesh position-y={0.28} scale={[0.95, 0.55, 1.1]} material={mats.body} castShadow>
        <sphereGeometry args={[0.42, 16, 10]} />
      </mesh>

      {/* Two wing halves, slightly apart */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.025, 0.3, 0]} scale={[1, 0.6, 1.15]} material={mats.shell} castShadow>
          <sphereGeometry args={[0.46, 16, 12, s > 0 ? Math.PI / 2 : -Math.PI / 2, Math.PI, 0, Math.PI / 2]} />
        </mesh>
      ))}

      {/* Spots */}
      {[-1, 1].flatMap((s) =>
        SPOT_DIRS.map(([across, along], i) => (
          <mesh key={`${s}-${i}`} position={shellPoint(s, across, along)} scale={[1, 0.5, 1]} material={mats.spot}>
            <sphereGeometry args={[0.075, 8, 6]} />
          </mesh>
        )),
      )}

      {/* Head with big eyes */}
      <mesh position={[0, 0.26, 0.52]} material={mats.body} castShadow>
        <sphereGeometry args={[0.21, 14, 10]} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.1, 0.36, 0.64]}>
          <mesh material={mats.eye}>
            <sphereGeometry args={[0.075, 10, 8]} />
          </mesh>
          <mesh position={[0, 0.01, 0.05]} material={mats.body}>
            <sphereGeometry args={[0.04, 8, 6]} />
          </mesh>
        </group>
      ))}

      {/* Antennae */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.08, 0.42, 0.6]} rotation={[0.6, 0, s * -0.5]}>
          <mesh position-y={0.14} material={mats.body}>
            <cylinderGeometry args={[0.015, 0.015, 0.28, 4]} />
          </mesh>
          <mesh position-y={0.29} material={kind === 'golden' ? mats.shell : mats.body}>
            <sphereGeometry args={[0.04, 6, 5]} />
          </mesh>
        </group>
      ))}

      {/* Legs: three per side */}
      {[-1, 1].flatMap((s, si) =>
        [0.25, 0, -0.25].map((z, i) => (
          <Leg
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

      {kind === 'boss' && (
        <>
          {/* Little horns and an office tie */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.15, 0.44, 0.48]} rotation-z={s * -0.5} material={mats.horn}>
              <coneGeometry args={[0.05, 0.16, 6]} />
            </mesh>
          ))}
          {/* Angry brows */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.1, 0.45, 0.66]} rotation-z={s * 0.4} material={mats.body}>
              <boxGeometry args={[0.11, 0.025, 0.03]} />
            </mesh>
          ))}
          <mesh position={[0, 0.1, 0.66]} rotation-x={0.3} material={mats.tie}>
            <coneGeometry args={[0.06, 0.2, 4]} />
          </mesh>
        </>
      )}
    </>
  )
}

const SPARKS = 12

const debugBugs: Record<string, unknown> = {}
if (import.meta.env.DEV) (window as unknown as { __bugs: typeof debugBugs }).__bugs = debugBugs

function Bug({ def }: { def: BugDef }) {
  const spec = BUG_SPECS[def.kind]
  const golden = def.kind === 'golden'

  const root = useRef<Group>(null)
  const body = useRef<Group>(null)
  const halo = useRef<Group>(null)
  const burst = useRef<Group>(null)
  const pop = useRef<Mesh>(null)
  const legs = useRef<(Group | null)[]>([])
  const motion = useRef(startMotion(def))
  const caughtAt = useRef<number | null>(null)
  const done = useRef(useGame.getState().caught.includes(def.id))
  // Dev only: lets local checks and tests see where each bug is.
  if (import.meta.env.DEV) debugBugs[def.id] = motion.current

  const mats = useMemo(() => makeMats(def.kind), [def.kind])
  const fx = useMemo(
    () => ({
      spark: new MeshBasicMaterial({ color: golden ? '#F2C14E' : '#E4EDE6', transparent: true, depthWrite: false }),
      pop: new MeshBasicMaterial({ color: golden ? '#F2C14E' : '#E4EDE6', transparent: true, depthWrite: false }),
      // Random but fixed burst directions: [angle, speed, lift]
      dirs: Array.from({ length: SPARKS }, (_, i) => [
        (i / SPARKS) * Math.PI * 2 + Math.random() * 0.4,
        2 + Math.random() * 1.5,
        2 + Math.random() * 2,
      ]),
    }),
    [golden],
  )

  useFrame(({ clock }, rawDelta) => {
    if (done.current || !root.current || !body.current) return
    const dt = Math.min(rawDelta, 0.05)
    const now = clock.elapsedTime
    const m = motion.current
    const state = useGame.getState()

    // Catch animation: scooped up, spinning, shrinking away, with a burst of sparks.
    if (caughtAt.current !== null) {
      const t = Math.min((now - caughtAt.current) / CATCH_TIME, 1)
      const s = 1 - t * t
      body.current.position.y = Math.sin(t * Math.PI) * 2.2 * (golden ? 1.3 : 1)
      body.current.rotation.y += dt * 14
      body.current.scale.setScalar(Math.max(s, 0.001))
      if (burst.current) {
        burst.current.visible = true
        burst.current.children.forEach((c, i) => {
          const [a, speed, lift] = fx.dirs[i]
          const r = speed * t * (golden ? 1.4 : 1)
          c.position.set(Math.cos(a) * r, 0.5 + lift * t - 3 * t * t, Math.sin(a) * r)
          c.rotation.y += dt * 8
        })
        fx.spark.opacity = 1 - t
      }
      if (pop.current) {
        pop.current.visible = true
        pop.current.scale.setScalar(0.5 + t * (golden ? 4 : 2.5))
        fx.pop.opacity = 0.8 * (1 - t)
      }
      if (t >= 1) {
        done.current = true
        root.current.visible = false
      }
      return
    }

    stepBug(m, def, state.focus, dt)

    // Caught when the net comes down close enough, anywhere between the hero and the ring.
    const p = (now - state.swingStartedAt) / SWING_TIME
    if (p >= NET_DOWN_FROM && p <= NET_DOWN_TO) {
      if (distToSegment(m.x, m.z, state.focus, state.netPos) < spec.catchRadius) {
        caughtAt.current = now
        state.catchBug(def.id)
      }
    }

    // Zone pads are raised a little above the grass.
    const zone = zoneOf(def)
    const onPad = Math.hypot(m.x - zone.position[0], m.z - zone.position[1]) < zone.radius
    root.current.position.set(m.x, onPad ? 0.12 : 0, m.z)
    root.current.rotation.y = m.facing

    // Tripod gait: alternate legs swing back and forth while moving, with a little bounce.
    const running = m.moved > 0 ? 1 : 0
    legs.current.forEach((leg, i) => {
      if (!leg) return
      const alt = (i % 2 === 0 ? 1 : -1) * (i < 3 ? 1 : -1)
      leg.rotation.y = Math.sin(m.phase) * 0.5 * alt * running
    })
    body.current.position.y = Math.abs(Math.sin(m.phase)) * 0.06 * running
    // Shiver when scared, so the player sees it noticed them.
    body.current.rotation.z = m.mode === 'flee' ? Math.sin(now * 40) * 0.06 : 0

    if (halo.current) {
      halo.current.rotation.y = now * 1.5
      halo.current.position.y = 1.1 + Math.sin(now * 2.5) * 0.1
      mats.shell.emissiveIntensity = 0.25 + Math.sin(now * 3) * 0.15
    }
  })

  return (
    <group ref={root} scale={spec.scale}>
      {/* Soft round shadow */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
        <circleGeometry args={[0.55, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.25} depthWrite={false} />
      </mesh>

      <group ref={body}>
        <BugModel kind={def.kind} mats={mats} legs={legs} />
      </group>

      {/* Golden bugs: three little sparkles circling above, so they stand out */}
      {golden && (
        <group ref={halo}>
          {[0, 1, 2].map((i) => {
            const a = (i / 3) * Math.PI * 2
            return (
              <mesh key={i} position={[Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45]} material={fx.spark}>
                <octahedronGeometry args={[0.08, 0]} />
              </mesh>
            )
          })}
        </group>
      )}

      {/* Catch effects, hidden until the catch */}
      <group ref={burst} visible={false}>
        {fx.dirs.map((_, i) => (
          <mesh key={i} material={fx.spark}>
            <octahedronGeometry args={[golden ? 0.14 : 0.1, 0]} />
          </mesh>
        ))}
      </group>
      <mesh ref={pop} rotation-x={-Math.PI / 2} position-y={0.05} visible={false} material={fx.pop}>
        <ringGeometry args={[0.45, 0.6, 24]} />
      </mesh>
    </group>
  )
}

export function Bugs() {
  return (
    <>
      {BUGS.map((def) => (
        <Bug key={def.id} def={def} />
      ))}
    </>
  )
}

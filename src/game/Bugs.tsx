import { useMemo, useRef, useState, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry } from 'three'
import { animateBoss, BossModel, type BossParts } from './BossBug'
import { Kit, rod } from './kit'
import { testHooks } from './device'
import { BUG_SPECS, BUGS, startMotion, stepBug, zoneOf, type BugDef, type BugKind, type BugMotion } from './bugs'
import { SWING_TIME } from './Player'
import { useGame } from './store'

/** The net is on its way down between these points of the swing. */
export const NET_DOWN_FROM = 0.3
export const NET_DOWN_TO = 0.55

/**
 * True if the net came down at any point since the last frame. Checking only "now" would miss the
 * short down window on slow devices, where one frame can jump right over it.
 */
export function netCameDown(now: number, frameTime: number, swingStartedAt: number) {
  const from = swingStartedAt + NET_DOWN_FROM * SWING_TIME
  const to = swingStartedAt + NET_DOWN_TO * SWING_TIME
  return now >= from && now - frameTime <= to
}
/** Length of the catch animation, in seconds. */
const CATCH_TIME = 0.9

const SHELL: Record<BugKind, string> = { normal: '#E8392B', golden: '#F2C14E', boss: '#D9452B' }
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
        ? new MeshStandardMaterial({
            color: SHELL.golden,
            roughness: 0.3,
            metalness: 0.4,
            emissive: '#F2C14E',
            emissiveIntensity: 0.3,
          })
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

/** Point on the shell ellipsoid in a given direction, `lift` times the shell size. */
function shellPoint(side: number, across: number, along: number, lift = 1): [number, number, number] {
  const x = Math.sin(across) * Math.cos(along) * side
  const y = Math.cos(across) * Math.cos(along)
  const z = Math.sin(along)
  return [x * 0.46 * lift, 0.3 + y * 0.46 * 0.6 * lift, z * 0.46 * 1.15 * lift]
}

/** Colour-per-part material for the merged bug details. */
const DETAIL = new MeshStandardMaterial({ vertexColors: true, roughness: 0.45 })

const hex = (m: MeshStandardMaterial) => `#${m.color.getHexString()}`

/** Leg for the right side, from the hip: thigh up and out, shin down to a little foot. */
const LEG = (() => {
  const kit = new Kit()
  kit.add(rod([0, 0, 0], [0.16, 0.06, 0], 0.03, 0.025), '#000000')
  kit.add(rod([0.16, 0.06, 0], [0.34, -0.17, 0.02], 0.025, 0.014), '#000000')
  kit.ball(0.028, [0.16, 0.06, 0], '#000000')
  kit.ball(0.024, [0.35, -0.18, 0.04], '#000000', { scale: [1, 0.6, 1.5] })
  return kit.build().main!
})()

/**
 * Builds a ladybug as two merged meshes: the shell (its own material, so golden bugs can glow)
 * and everything else in one piece with per-part colours.
 */
function bugGeometry(kind: BugKind, mats: Mats) {
  const shell = new Kit()
  for (const s of [-1, 1]) {
    const half = new SphereGeometry(0.46, 18, 12, s > 0 ? Math.PI / 2 : -Math.PI / 2, Math.PI, 0, Math.PI / 2)
    half.scale(1, 0.6, 1.15)
    shell.add(half, '#ffffff', [s * 0.025, 0.3, 0])
  }

  const body = hex(mats.body)
  const d = new Kit()
  // Dark body underneath, shows as the line between the wings.
  d.ball(0.42, [0, 0.28, 0], body, { scale: [0.95, 0.55, 1.1] })
  for (const s of [-1, 1]) {
    // Spots, and a soft shine on each wing.
    SPOT_DIRS.forEach(([across, along], i) =>
      d.ball(i === 0 ? 0.08 : 0.07, shellPoint(s, across, along, 1.005), hex(mats.spot), { scale: [1, 0.5, 1] }),
    )
    d.ball(0.07, shellPoint(s, 0.38, 0.05, 1.01), '#FFFFFF', { scale: [0.7, 0.3, 1.5] })
  }
  // Shield behind the head with the two white patches real ladybugs have.
  d.ball(0.24, [0, 0.36, 0.42], body, { scale: [1, 0.5, 0.55] })
  for (const s of [-1, 1]) d.ball(0.08, [s * 0.13, 0.42, 0.47], '#F4F1EA', { scale: [0.8, 0.35, 0.6] })
  // Head, big shiny eyes.
  d.ball(0.2, [0, 0.26, 0.55], body)
  for (const s of [-1, 1]) {
    d.ball(0.075, [s * 0.1, 0.36, 0.66], hex(mats.eye))
    d.ball(0.04, [s * 0.1, 0.37, 0.715], body)
    d.ball(0.013, [s * 0.085, 0.395, 0.745], '#FFFFFF')
  }
  // Bent antennae with a bead in the middle and a club at the tip (gold on golden bugs).
  const tip = kind === 'golden' ? hex(mats.shell) : body
  for (const s of [-1, 1]) {
    const base: [number, number, number] = [s * 0.07, 0.42, 0.62]
    const mid: [number, number, number] = [s * 0.13, 0.58, 0.72]
    const end: [number, number, number] = [s * 0.21, 0.68, 0.69]
    d.add(rod(base, mid, 0.016, 0.014), body)
    d.add(rod(mid, end, 0.014, 0.012), body)
    d.ball(0.022, mid, body)
    d.ball(0.042, end, tip, { scale: [1, 1.2, 1] })
  }
  return { shell: shell.build().main!, detail: d.build().main! }
}

/** Cute ladybug facing +z: shell, details and six legs. Golden bugs shine. */
export function BugModel({ kind, mats, legs }: { kind: BugKind; mats: Mats; legs: RefObject<(Group | null)[]> }) {
  const geo = useMemo(() => bugGeometry(kind, mats), [kind, mats])
  return (
    <>
      <mesh geometry={geo.detail} material={DETAIL} castShadow />
      <mesh geometry={geo.shell} material={mats.shell} castShadow />
      {[-1, 1].flatMap((s, si) =>
        [0.25, 0, -0.25].map((z, i) => (
          <group
            key={`${s}-${i}`}
            ref={(g) => {
              legs.current[si * 3 + i] = g
            }}
            position={[s * 0.32, 0.18, z]}
          >
            <mesh geometry={LEG} material={mats.body} scale-x={s} />
          </group>
        )),
      )}
    </>
  )
}

const SPARKS = 12

/**
 * Where each bug is, kept outside React so it survives the scene being rebuilt
 * (going to the CV page and back): bugs carry on from where they were.
 */
const motions = new Map<string, BugMotion>()

const debugBugs: Record<string, unknown> = {}
if (testHooks) (window as unknown as { __bugs: typeof debugBugs }).__bugs = debugBugs

function Bug({ def }: { def: BugDef }) {
  const spec = BUG_SPECS[def.kind]
  const golden = def.kind === 'golden'

  const root = useRef<Group>(null)
  const body = useRef<Group>(null)
  const halo = useRef<Group>(null)
  const burst = useRef<Group>(null)
  const pop = useRef<Mesh>(null)
  const legs = useRef<(Group | null)[]>([])
  const boss = useRef<BossParts>({ cases: [], wings: [] })
  /** Boss only: how far its wings are open, 0..1. */
  const wingsOpen = useRef(0)
  const motion = useRef(motions.get(def.id) ?? startMotion(def))
  motions.set(def.id, motion.current)
  const caughtAt = useRef<number | null>(null)
  /** Caught before this scene was built (e.g. before a trip to the CV page): never drawn again. */
  const [caughtBefore] = useState(() => useGame.getState().caught.includes(def.id))
  const done = useRef(caughtBefore)
  // Dev or ?test=1 only: lets local checks and tests see where each bug is.
  if (testHooks) debugBugs[def.id] = motion.current

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
    if (netCameDown(now, rawDelta, state.swingStartedAt)) {
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
    // The boss spreads its wings and buzzes while the player is in its zone.
    if (def.kind === 'boss') {
      const near = Math.hypot(state.focus[0] - zone.position[0], state.focus[1] - zone.position[1]) < zone.radius + 1
      wingsOpen.current += ((near ? 1 : 0) - wingsOpen.current) * (1 - Math.exp(-4 * dt))
      body.current.position.y += animateBoss(boss.current, wingsOpen.current, now)
    }
    // Shiver when scared, so the player sees it noticed them.
    body.current.rotation.z = m.mode === 'flee' ? Math.sin(now * 40) * 0.06 : 0

    if (halo.current) {
      halo.current.rotation.y = now * 1.5
      halo.current.position.y = 1.1 + Math.sin(now * 2.5) * 0.1
      mats.shell.emissiveIntensity = 0.25 + Math.sin(now * 3) * 0.15
    }
  })

  if (caughtBefore) return null
  return (
    <group ref={root} scale={spec.scale}>
      {/* Soft round shadow */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
        <circleGeometry args={[0.55, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.25} depthWrite={false} />
      </mesh>

      <group ref={body}>
        {def.kind === 'boss' ? (
          <BossModel mats={mats} legs={legs} boss={boss} />
        ) : (
          <BugModel kind={def.kind} mats={mats} legs={legs} />
        )}
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

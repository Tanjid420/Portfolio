// The magnifying glass and the hidden easter-egg bugs it reveals.

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from 'three'
import { BugModel, distToSegment, netCameDown, type Mats } from './Bugs'
import { HIDDEN_BUGS, REVEAL_DISTANCE, type HiddenBugDef } from './hidden'
import { isPaused, useGame } from './store'
import { MAGNIFIER_SPOT } from './world'

const PURPLE = '#9B6BFF'
/** The player picks up the glass when this close to the pedestal. */
const PICKUP_DISTANCE = 1.7
const CATCH_RADIUS = 1.4
const CATCH_TIME = 0.8
const SCALE = 1.1

/** Stone pedestal with a floating, spinning magnifying glass. Walk into it to pick it up. */
export function Magnifier() {
  const glass = useRef<Group>(null)
  const [x, z] = MAGNIFIER_SPOT

  useFrame(({ clock }) => {
    const g = glass.current
    if (!g) return
    const state = useGame.getState()
    g.visible = !state.hasGlass
    if (state.hasGlass) return
    const t = clock.elapsedTime
    g.rotation.y = t * 1.5
    g.position.y = 1.55 + Math.sin(t * 2.2) * 0.12
    const [px, pz] = state.focus
    if (Math.hypot(px - x, pz - z) < PICKUP_DISTANCE && !isPaused(state)) state.pickUpGlass()
  })

  return (
    <group position={[x, 0.12, z]}>
      <mesh position-y={0.4} castShadow receiveShadow>
        <cylinderGeometry args={[0.3, 0.4, 0.8, 6]} />
        <meshStandardMaterial color="#6B7A72" flatShading roughness={1} />
      </mesh>
      <mesh position-y={0.83} castShadow>
        <cylinderGeometry args={[0.45, 0.45, 0.08, 6]} />
        <meshStandardMaterial color="#9BB0A2" flatShading />
      </mesh>
      <group ref={glass} position-y={1.55}>
        <group rotation-z={0.5}>
          <mesh>
            <torusGeometry args={[0.32, 0.06, 8, 20]} />
            <meshStandardMaterial
              color="#F2C14E"
              metalness={0.5}
              roughness={0.3}
              emissive="#7A5410"
              emissiveIntensity={0.4}
            />
          </mesh>
          <mesh>
            <circleGeometry args={[0.3, 20]} />
            <meshStandardMaterial color="#BFE9F2" transparent opacity={0.45} side={2} roughness={0.1} />
          </mesh>
          <mesh position-y={-0.6}>
            <cylinderGeometry args={[0.05, 0.06, 0.55, 6]} />
            <meshStandardMaterial color="#5A3A2A" flatShading />
          </mesh>
        </group>
        <pointLight color="#F2C14E" intensity={2} distance={4} />
      </group>
    </group>
  )
}

function makeMats(): Mats {
  const m = (color: string, roughness = 0.6) => new MeshStandardMaterial({ color, roughness })
  return {
    shell: new MeshStandardMaterial({ color: PURPLE, roughness: 0.35, emissive: PURPLE, emissiveIntensity: 0.35 }),
    spot: m('#2A1550'),
    body: m('#1A1A1A', 0.8),
    eye: m('#FFFFFF', 0.3),
    horn: m('#E4EDE6', 0.5),
    tie: m('#3E7BE0', 0.6),
  }
}

/** Sits still and looks around. Grows into view when the player with the glass comes close. */
function HiddenBug({ def }: { def: HiddenBugDef }) {
  const root = useRef<Group>(null)
  const body = useRef<Group>(null)
  const ring = useRef<Mesh>(null)
  const legs = useRef<(Group | null)[]>([])
  const reveal = useRef(0)
  const caughtAt = useRef<number | null>(null)
  const done = useRef(useGame.getState().found.includes(def.id))
  const mats = useMemo(makeMats, [])
  const ringMat = useMemo(() => new MeshBasicMaterial({ color: PURPLE, transparent: true, depthWrite: false }), [])
  const [x, z] = def.position

  useFrame(({ clock }, rawDelta) => {
    const r = root.current
    const b = body.current
    if (!r || !b) return
    if (done.current) {
      r.visible = false
      return
    }
    const dt = Math.min(rawDelta, 0.05)
    const now = clock.elapsedTime
    const state = useGame.getState()

    // Caught: spin up and shrink away.
    if (caughtAt.current !== null) {
      const t = Math.min((now - caughtAt.current) / CATCH_TIME, 1)
      b.position.y = Math.sin(t * Math.PI) * 2
      b.rotation.y += dt * 14
      b.scale.setScalar(Math.max(1 - t * t, 0.001))
      ringMat.opacity = 0.6 * (1 - t)
      if (t >= 1) done.current = true
      return
    }

    const near = state.hasGlass && Math.hypot(state.focus[0] - x, state.focus[1] - z) < REVEAL_DISTANCE
    reveal.current += ((near ? 1 : 0) - reveal.current) * (1 - Math.exp(-6 * dt))
    r.visible = reveal.current > 0.02
    if (!r.visible) return

    b.scale.setScalar(reveal.current)
    ringMat.opacity = 0.5 * reveal.current * (0.6 + Math.sin(now * 4) * 0.4)
    if (ring.current) ring.current.scale.setScalar(1 + Math.sin(now * 4) * 0.08)
    // Looks around and taps its legs.
    b.rotation.y = Math.sin(now * 0.8 + x) * 0.9
    legs.current.forEach((leg, i) => {
      if (leg) leg.rotation.y = Math.sin(now * 10 + i) * 0.15
    })

    // Same catch rule as the main bugs: the net coming down anywhere between the hero and the ring.
    if (reveal.current > 0.5 && netCameDown(now, rawDelta, state.swingStartedAt)) {
      if (distToSegment(x, z, state.focus, state.netPos) < CATCH_RADIUS) {
        caughtAt.current = now
        state.findHidden(def.id)
      }
    }
  })

  return (
    <group ref={root} position={[x, 0, z]} visible={false}>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.04} material={ringMat}>
        <ringGeometry args={[0.8, 1, 24]} />
      </mesh>
      <group ref={body} scale={0.001}>
        <group scale={SCALE}>
          <BugModel kind="normal" mats={mats} legs={legs} />
        </group>
      </group>
    </group>
  )
}

export function HiddenBugs() {
  return (
    <>
      <Magnifier />
      {HIDDEN_BUGS.map((def) => (
        <HiddenBug key={def.id} def={def} />
      ))}
    </>
  )
}

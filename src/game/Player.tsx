import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, Group, MeshStandardMaterial, Vector3 } from 'three'
import { touch } from './input'
import { PLAYER_START, useGame } from './store'
import { isWalkable } from './world'

const SPEED = 7 // units per second
const BODY_RADIUS = 0.7
/** The model is built about 2.2 units tall, then scaled up so it reads well from the high camera. */
const MODEL_SCALE = 1.6
/** How long one net swing takes, in seconds. */
export const SWING_TIME = 0.4

const COLORS = {
  skin: '#E8B98F',
  skinShade: '#D49E74',
  hair: '#2A1C14',
  jacket: '#3E7BE0', // blue, so the hero stands out from the green island
  zip: '#E4EDE6',
  pants: '#2E3440',
  shoes: '#F4F4F4',
  sole: '#3A3A3A',
  mask: '#1B2540',
  eye: '#FFFFFF',
  iris: '#4A2F1E',
  mouth: '#9C3B3B',
  badge: '#F2C14E',
  handle: '#8A6440',
  ring: '#E4EDE6',
}

// Arm pitch (shoulder) and wrist pitch for each swing keyframe.
// Negative arm pitch moves the hand forward. Idle holds the net upright.
const POSE = {
  idle: { arm: -0.5, wrist: 0.6 },
  windup: { arm: -0.9, wrist: 0.3 },
  strike: { arm: -1.0, wrist: 2.9 },
}

const KEYS: Record<string, 'up' | 'down' | 'left' | 'right'> = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
}

const smooth = (t: number) => t * t * (3 - 2 * t)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Arm and wrist angles at swing progress p (0..1). */
function swingPose(p: number) {
  const { idle, windup, strike } = POSE
  if (p < 0.3) {
    const t = smooth(p / 0.3)
    return { arm: lerp(idle.arm, windup.arm, t), wrist: lerp(idle.wrist, windup.wrist, t) }
  }
  if (p < 0.55) {
    const t = smooth((p - 0.3) / 0.25)
    return { arm: lerp(windup.arm, strike.arm, t), wrist: lerp(windup.wrist, strike.wrist, t) }
  }
  const t = smooth((p - 0.55) / 0.45)
  return { arm: lerp(strike.arm, idle.arm, t), wrist: lerp(strike.wrist, idle.wrist, t) }
}

/** Ignore keys while the user is typing or using a button or link. */
function isInteractive(target: EventTarget | null) {
  return target instanceof Element && !!target.closest('a, button, input, textarea, select')
}

function useKeyboard() {
  const held = useRef({ up: false, down: false, left: false, right: false })
  const swingRequested = useRef(false)

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (isInteractive(e.target)) return
      const dir = KEYS[e.code]
      if (dir) {
        held.current[dir] = true
        e.preventDefault()
      } else if (e.code === 'Space') {
        if (!e.repeat) swingRequested.current = true
        e.preventDefault()
      }
    }
    const onUp = (e: KeyboardEvent) => {
      const dir = KEYS[e.code]
      if (dir) held.current[dir] = false
    }
    const reset = () => {
      held.current = { up: false, down: false, left: false, right: false }
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', reset)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', reset)
    }
  }, [])

  return { held, swingRequested }
}

type Mats = Record<string, MeshStandardMaterial>

/** One leg, pivoting at the hip. */
function Leg({ groupRef, x, mats }: { groupRef: RefObject<Group | null>; x: number; mats: Mats }) {
  return (
    <group ref={groupRef} position={[x, 0.86, 0]}>
      <mesh position-y={-0.38} material={mats.pants} castShadow>
        <cylinderGeometry args={[0.1, 0.085, 0.76, 10]} />
      </mesh>
      <mesh position={[0, -0.8, 0.05]} material={mats.shoes} castShadow>
        <boxGeometry args={[0.16, 0.09, 0.3]} />
      </mesh>
      <mesh position={[0, -0.85, 0.05]} material={mats.sole}>
        <boxGeometry args={[0.17, 0.03, 0.31]} />
      </mesh>
    </group>
  )
}

/** One arm, pivoting at the shoulder. The hand ends at y = -0.56. */
function Arm({ mats }: { mats: Mats }) {
  return (
    <>
      <mesh position-y={-0.26} material={mats.jacket} castShadow>
        <capsuleGeometry args={[0.075, 0.38, 4, 10]} />
      </mesh>
      <mesh position-y={-0.57} material={mats.skin}>
        <sphereGeometry args={[0.07, 10, 8]} />
      </mesh>
    </>
  )
}

/** Head with a readable face: brows, eyes behind a slim hero mask, nose and a smile. */
function Head({ mats }: { mats: Mats }) {
  return (
    // Tipped up a little so the face shows to the high camera.
    <group position-y={1.9} rotation-x={-0.2}>
      <group scale={[0.92, 1.05, 0.95]}>
        <mesh material={mats.skin} castShadow>
          <sphereGeometry args={[0.26, 24, 16]} />
        </mesh>
        {/* Hair: a cap tipped back so the forehead shows */}
        <mesh position={[0, 0.02, -0.03]} rotation-x={-0.65} material={mats.hair} castShadow>
          <sphereGeometry args={[0.275, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        </mesh>
        {/* Slim hero mask across the eyes, front half only */}
        <mesh position-y={0.02} material={mats.mask}>
          <cylinderGeometry args={[0.266, 0.262, 0.1, 24, 1, true, -1.3, 2.6]} />
        </mesh>
      </group>

      {/* Ears */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.235, 0, 0]} scale={[0.5, 1, 0.8]} material={mats.skinShade}>
          <sphereGeometry args={[0.055, 10, 8]} />
        </mesh>
      ))}

      {/* Eyes: white, brown iris, small shine */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.085, 0.02, 0.238]}>
          <mesh scale={[1, 1.1, 0.5]} material={mats.eye}>
            <sphereGeometry args={[0.05, 14, 10]} />
          </mesh>
          <mesh position-z={0.018} scale={[1, 1, 0.5]} material={mats.iris}>
            <sphereGeometry args={[0.03, 12, 8]} />
          </mesh>
          <mesh position={[0.01, 0.012, 0.035]} material={mats.eye}>
            <sphereGeometry args={[0.009, 6, 4]} />
          </mesh>
        </group>
      ))}

      {/* Eyebrows */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.085, 0.095, 0.236]} rotation-z={s * -0.15} material={mats.hair}>
          <boxGeometry args={[0.075, 0.018, 0.02]} />
        </mesh>
      ))}

      {/* Nose */}
      <mesh position={[0, -0.045, 0.255]} scale={[0.8, 1, 1]} material={mats.skinShade}>
        <sphereGeometry args={[0.03, 10, 8]} />
      </mesh>

      {/* Smile */}
      <mesh position={[0, -0.11, 0.228]} rotation={[-0.3, 0, Math.PI]} material={mats.mouth}>
        <torusGeometry args={[0.045, 0.012, 6, 12, Math.PI]} />
      </mesh>
    </group>
  )
}

const ringWorld = new Vector3()

export function Player() {
  const root = useRef<Group>(null)
  const bob = useRef<Group>(null)
  const legL = useRef<Group>(null)
  const legR = useRef<Group>(null)
  const armL = useRef<Group>(null)
  const armR = useRef<Group>(null)
  const wrist = useRef<Group>(null)
  const ring = useRef<Group>(null)

  const { held, swingRequested } = useKeyboard()
  const motion = useRef({ x: PLAYER_START[0], z: PLAYER_START[1], facing: 0, walk: 0, phase: 0 })

  const mats = useMemo<Mats>(() => {
    const m = (color: string, roughness = 0.75) => new MeshStandardMaterial({ color, roughness })
    return {
      skin: m(COLORS.skin, 0.6),
      skinShade: m(COLORS.skinShade, 0.6),
      hair: m(COLORS.hair, 0.9),
      jacket: m(COLORS.jacket, 0.7),
      zip: m(COLORS.zip),
      pants: m(COLORS.pants, 0.9),
      shoes: m(COLORS.shoes, 0.5),
      sole: m(COLORS.sole),
      mask: new MeshStandardMaterial({ color: COLORS.mask, roughness: 0.5, side: DoubleSide }),
      eye: m(COLORS.eye, 0.3),
      iris: m(COLORS.iris, 0.3),
      mouth: m(COLORS.mouth, 0.6),
      badge: m(COLORS.badge, 0.5),
      handle: m(COLORS.handle),
      ring: m(COLORS.ring),
      net: new MeshStandardMaterial({
        color: COLORS.ring,
        transparent: true,
        opacity: 0.45,
        side: DoubleSide,
        wireframe: true,
      }),
    }
  }, [])

  useFrame(({ clock }, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05) // avoid big jumps after a tab switch
    const m = motion.current
    const keys = held.current
    const state = useGame.getState()
    // The hero waits while a bug report is open.
    const paused = state.cardQueue.length > 0
    if (touch.swing) {
      touch.swing = false
      swingRequested.current = true
    }
    if (paused) swingRequested.current = false

    // Movement: screen up is -z because the camera looks north. Keys and the joystick add up.
    let dx = paused ? 0 : (keys.right ? 1 : 0) - (keys.left ? 1 : 0) + touch.x
    let dz = paused ? 0 : (keys.down ? 1 : 0) - (keys.up ? 1 : 0) + touch.z
    const len = Math.hypot(dx, dz)
    let moved = 0
    if (len > 0.01) {
      // Full speed caps at 1. A light joystick push walks slower.
      if (len > 1) {
        dx /= len
        dz /= len
      }
      const step = SPEED * delta
      const nx = m.x + dx * step
      const nz = m.z + dz * step
      const startX = m.x
      const startZ = m.z
      // Slide along edges: try the full move, then each axis alone.
      if (isWalkable(nx, nz, BODY_RADIUS)) {
        m.x = nx
        m.z = nz
      } else if (isWalkable(nx, m.z, BODY_RADIUS)) {
        m.x = nx
      } else if (isWalkable(m.x, nz, BODY_RADIUS)) {
        m.z = nz
      }
      moved = Math.hypot(m.x - startX, m.z - startZ)

      // Turn smoothly toward the direction of travel, the short way round.
      const target = Math.atan2(dx, dz)
      let diff = target - m.facing
      diff = Math.atan2(Math.sin(diff), Math.cos(diff))
      m.facing += diff * (1 - Math.exp(-14 * delta))
    }

    // Walk cycle follows distance covered, so running into a wall stops the legs.
    const walking = moved > 0.001 ? 1 : 0
    m.walk = lerp(m.walk, walking, 1 - Math.exp(-10 * delta))
    m.phase += moved * 2.6
    const swingLeg = Math.sin(m.phase) * 0.7 * m.walk

    // Net swing.
    let swingStartedAt = state.swingStartedAt
    const now = clock.elapsedTime
    if (swingRequested.current) {
      swingRequested.current = false
      if (now - swingStartedAt >= SWING_TIME) swingStartedAt = now
    }
    const p = (now - swingStartedAt) / SWING_TIME
    const pose = p >= 0 && p < 1 ? swingPose(p) : POSE.idle

    if (root.current) {
      root.current.position.set(m.x, 0, m.z)
      root.current.rotation.y = m.facing
    }
    if (bob.current) bob.current.position.y = Math.abs(Math.sin(m.phase)) * 0.1 * m.walk
    if (legL.current) legL.current.rotation.x = swingLeg
    if (legR.current) legR.current.rotation.x = -swingLeg
    if (armL.current) armL.current.rotation.x = -swingLeg * 0.8
    if (armR.current) armR.current.rotation.x = pose.arm
    if (wrist.current) wrist.current.rotation.x = pose.wrist

    let netPos = state.netPos
    if (ring.current) {
      ring.current.getWorldPosition(ringWorld)
      netPos = [ringWorld.x, ringWorld.z]
    }

    useGame.setState({ focus: [m.x, m.z], facing: m.facing, netPos, swingStartedAt })
  })

  return (
    <group ref={root} position={[PLAYER_START[0], 0, PLAYER_START[1]]} scale={MODEL_SCALE}>
      {/* Soft round shadow so the hero reads well from above */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.13}>
        <circleGeometry args={[0.45, 20]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.25} depthWrite={false} />
      </mesh>

      <group ref={bob}>
        {/* Legs */}
        <Leg groupRef={legL} x={-0.11} mats={mats} />
        <Leg groupRef={legR} x={0.11} mats={mats} />

        {/* Hips */}
        <mesh position-y={0.86} scale={[1, 1, 0.75]} material={mats.pants} castShadow>
          <cylinderGeometry args={[0.23, 0.21, 0.18, 14]} />
        </mesh>

        {/* Torso: blue jacket with a zip and a yellow QA badge */}
        <mesh position-y={1.17} scale={[1, 1, 0.72]} material={mats.jacket} castShadow>
          <capsuleGeometry args={[0.25, 0.36, 6, 14]} />
        </mesh>
        <mesh position={[0, 1.15, 0.183]} material={mats.zip}>
          <boxGeometry args={[0.022, 0.5, 0.01]} />
        </mesh>
        <mesh position={[0.11, 1.28, 0.175]} rotation-x={-0.15} material={mats.badge}>
          <boxGeometry args={[0.08, 0.1, 0.015]} />
        </mesh>

        {/* Neck */}
        <mesh position-y={1.66} material={mats.skin}>
          <cylinderGeometry args={[0.075, 0.08, 0.16, 10]} />
        </mesh>

        <Head mats={mats} />

        {/* Left arm swings while walking */}
        <group ref={armL} position={[-0.31, 1.47, 0]}>
          <Arm mats={mats} />
        </group>

        {/* Right arm holds the bug net */}
        <group ref={armR} position={[0.31, 1.47, 0]} rotation-x={POSE.idle.arm}>
          <Arm mats={mats} />
          <group ref={wrist} position-y={-0.57} rotation-x={POSE.idle.wrist}>
            {/* Leans out to the side so the net never hides the face */}
            <group rotation-z={-0.35}>
              {/* Handle points along +y from the hand */}
              <mesh position-y={0.55} material={mats.handle} castShadow>
                <cylinderGeometry args={[0.035, 0.035, 1.3, 6]} />
              </mesh>
              <group ref={ring} position-y={1.52}>
                <mesh material={mats.ring} castShadow>
                  <torusGeometry args={[0.32, 0.03, 6, 20]} />
                </mesh>
                <mesh position-z={-0.3} rotation-x={-Math.PI / 2} material={mats.net}>
                  <coneGeometry args={[0.31, 0.6, 12, 3, true]} />
                </mesh>
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}

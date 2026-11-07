import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, Group, MeshStandardMaterial, Vector3 } from 'three'
import { PLAYER_START, useGame } from './store'
import { isWalkable } from './world'

const SPEED = 7 // units per second
const BODY_RADIUS = 0.7
/** The model is built about 1.8 units tall, then scaled up so it reads well from the high camera. */
const MODEL_SCALE = 1.7
/** How long one net swing takes, in seconds. */
export const SWING_TIME = 0.4

const COLORS = {
  skin: '#F5D0A9',
  hair: '#3B2A20',
  hoodie: '#5DBB8C',
  pants: '#2B3A4A',
  shoes: '#17221B',
  mask: '#17221B',
  eye: '#FFFFFF',
  pupil: '#0F1712',
  blush: '#F59A8B',
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

function Leg({ groupRef, x, mats }: { groupRef: RefObject<Group | null>; x: number; mats: { pants: MeshStandardMaterial; shoes: MeshStandardMaterial } }) {
  return (
    <group ref={groupRef} position={[x, 0.55, 0]}>
      <mesh position-y={-0.22} material={mats.pants} castShadow>
        <cylinderGeometry args={[0.11, 0.12, 0.42, 6]} />
      </mesh>
      <mesh position={[0, -0.47, 0.05]} material={mats.shoes} castShadow>
        <boxGeometry args={[0.2, 0.12, 0.3]} />
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

  const mats = useMemo(() => {
    const m = (color: string) => new MeshStandardMaterial({ color, flatShading: true, roughness: 0.8 })
    return {
      skin: m(COLORS.skin),
      hair: m(COLORS.hair),
      hoodie: m(COLORS.hoodie),
      pants: m(COLORS.pants),
      shoes: m(COLORS.shoes),
      mask: m(COLORS.mask),
      eye: new MeshStandardMaterial({ color: COLORS.eye, roughness: 0.4 }),
      pupil: new MeshStandardMaterial({ color: COLORS.pupil, roughness: 0.3 }),
      blush: m(COLORS.blush),
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

    // Movement: screen up is -z because the camera looks north.
    let dx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0)
    let dz = (keys.down ? 1 : 0) - (keys.up ? 1 : 0)
    const len = Math.hypot(dx, dz)
    let moved = 0
    if (len > 0) {
      dx /= len
      dz /= len
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
        <circleGeometry args={[0.55, 20]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.25} depthWrite={false} />
      </mesh>

      <group ref={bob}>
        {/* Legs, pivoting at the hips */}
        <Leg groupRef={legL} x={-0.15} mats={mats} />
        <Leg groupRef={legR} x={0.15} mats={mats} />

        {/* Body */}
        <mesh position-y={0.85} material={mats.hoodie} castShadow>
          <capsuleGeometry args={[0.3, 0.3, 4, 8]} />
        </mesh>

        {/* Head: big and round, chibi style */}
        <group position-y={1.55}>
          <mesh material={mats.skin} castShadow>
            <icosahedronGeometry args={[0.44, 1]} />
          </mesh>
          {/* Hair cap */}
          <mesh position-y={0.08} rotation-x={-0.25} material={mats.hair} castShadow>
            <sphereGeometry args={[0.46, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.42]} />
          </mesh>
          {/* Hero mask: a band around the eyes with two tails at the back */}
          <mesh position-y={0.02} material={mats.mask}>
            <cylinderGeometry args={[0.455, 0.455, 0.18, 16, 1, true]} />
          </mesh>
          {[-0.12, 0.12].map((x) => (
            <mesh key={x} position={[x, -0.08, -0.45]} rotation={[0.6, 0, x * 2]} material={mats.mask}>
              <boxGeometry args={[0.08, 0.32, 0.03]} />
            </mesh>
          ))}
          {/* Eyes peek through the mask */}
          {[-0.15, 0.15].map((x) => (
            <group key={x} position={[x, 0.02, 0.41]}>
              <mesh material={mats.eye} scale={[1, 1.2, 0.6]}>
                <sphereGeometry args={[0.085, 10, 8]} />
              </mesh>
              <mesh position={[0, -0.01, 0.045]} material={mats.pupil}>
                <sphereGeometry args={[0.045, 8, 6]} />
              </mesh>
            </group>
          ))}
          {/* Rosy cheeks */}
          {[-0.24, 0.24].map((x) => (
            <mesh key={x} position={[x, -0.15, 0.36]} material={mats.blush} scale={[1, 0.6, 0.4]}>
              <sphereGeometry args={[0.06, 8, 6]} />
            </mesh>
          ))}
        </group>

        {/* Left arm swings while walking */}
        <group ref={armL} position={[-0.38, 1.05, 0]}>
          <mesh position-y={-0.2} material={mats.hoodie} castShadow>
            <capsuleGeometry args={[0.08, 0.26, 3, 6]} />
          </mesh>
          <mesh position-y={-0.42} material={mats.skin}>
            <sphereGeometry args={[0.09, 8, 6]} />
          </mesh>
        </group>

        {/* Right arm holds the bug net */}
        <group ref={armR} position={[0.38, 1.05, 0]} rotation-x={POSE.idle.arm}>
          <mesh position-y={-0.2} material={mats.hoodie} castShadow>
            <capsuleGeometry args={[0.08, 0.26, 3, 6]} />
          </mesh>
          <mesh position-y={-0.42} material={mats.skin}>
            <sphereGeometry args={[0.09, 8, 6]} />
          </mesh>
          <group ref={wrist} position-y={-0.42} rotation-x={POSE.idle.wrist}>
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
  )
}

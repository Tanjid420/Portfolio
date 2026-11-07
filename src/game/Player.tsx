import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, Group, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three'
import { touch } from './input'
import { isPaused, PLAYER_START, useGame } from './store'
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
  hairLight: '#3D2A1D',
  jacket: '#3E7BE0', // blue, so the hero stands out from the green island
  jacketDark: '#2F63BD',
  accent: '#5DBB8C',
  zip: '#E4EDE6',
  pants: '#2E3440',
  shoes: '#F4F4F4',
  sole: '#3A3A3A',
  lens: '#C8102E',
  glassesFrame: '#141618',
  frame: '#15181B',
  respirator: '#3E444A',
  valve: '#25292D',
  filter: '#F2C14E',
  filterFace: '#D9A630',
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
      {/* Trouser cuff */}
      <mesh position-y={-0.72} material={mats.pants}>
        <cylinderGeometry args={[0.095, 0.095, 0.05, 10]} />
      </mesh>
      {/* Rounded sneaker with a green side stripe */}
      <mesh position={[0, -0.8, 0.06]} rotation-x={Math.PI / 2} scale={[1, 1, 0.65]} material={mats.shoes} castShadow>
        <capsuleGeometry args={[0.08, 0.16, 4, 10]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.079, -0.8, 0.05]} rotation-x={-0.25} material={mats.accent}>
          <boxGeometry args={[0.01, 0.025, 0.16]} />
        </mesh>
      ))}
      <mesh position={[0, -0.85, 0.06]} material={mats.sole}>
        <boxGeometry args={[0.165, 0.03, 0.32]} />
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
      {/* Sleeve cuff */}
      <mesh position-y={-0.5} rotation-x={Math.PI / 2} material={mats.jacketDark}>
        <torusGeometry args={[0.072, 0.02, 6, 12]} />
      </mesh>
      <mesh position-y={-0.57} scale={[1, 1.1, 0.9]} material={mats.skin}>
        <sphereGeometry args={[0.07, 12, 10]} />
      </mesh>
      <mesh position={[0, -0.55, 0.06]} rotation-x={0.6} material={mats.skin}>
        <capsuleGeometry args={[0.022, 0.04, 3, 6]} />
      </mesh>
    </>
  )
}

interface Lock {
  position: [number, number, number]
  quaternion: Quaternion
  /** Half-sizes: [width, length, thickness]. */
  scale: [number, number, number]
  light: boolean
}

const deg = (d: number) => (d * Math.PI) / 180
const basis = new Matrix4()

/** Point on the head at polar angle `theta` (0 = top) and turn `phi` (0 = face front). */
function headPoint(theta: number, phi: number) {
  return new Vector3(Math.sin(theta) * Math.sin(phi), Math.cos(theta), Math.sin(theta) * Math.cos(phi))
}

/**
 * A soft, rounded lock of hair lying on the head at (theta, phi).
 * `down` and `sweep` aim it: down the head, and sideways around it.
 */
function lock(
  theta: number,
  phi: number,
  down: number,
  sweep: number,
  length: number,
  width: number,
  light = false,
): Lock {
  const n = headPoint(theta, phi)
  const towardNape = new Vector3(Math.cos(theta) * Math.sin(phi), -Math.sin(theta), Math.cos(theta) * Math.cos(phi))
  const around = new Vector3(Math.cos(phi), 0, -Math.sin(phi))
  const y = towardNape.multiplyScalar(down).addScaledVector(around, sweep).normalize()
  const x = new Vector3().crossVectors(y, n).normalize()
  const z = new Vector3().crossVectors(x, y)
  return {
    position: n.multiplyScalar(0.278).toArray() as [number, number, number],
    quaternion: new Quaternion().setFromRotationMatrix(basis.makeBasis(x, y, z)),
    scale: [width / 2, length / 2, 0.022],
    light,
  }
}

/** Short, tidy haircut in layers: crown, sides, back, sideburns and a fringe swept to one side. */
function hairLocks(): Lock[] {
  const out: Lock[] = []
  for (const p of [0, 72, 144, 216, 288]) out.push(lock(0.32, deg(p), 1, 0.25, 0.24, 0.15, true))
  for (const p of [60, 100, 140, 180, 220, 260, 300]) out.push(lock(0.78, deg(p), 1, 0.2, 0.24, 0.15, p % 80 === 20))
  for (const p of [110, 145, 180, 215, 250]) out.push(lock(1.2, deg(p), 1, 0.1, 0.2, 0.14))
  for (const p of [150, 180, 210]) out.push(lock(1.55, deg(p), 1, 0, 0.12, 0.12))
  // Sides and sideburns above the ears.
  for (const p of [-95, 95]) out.push(lock(1.1, deg(p), 1, 0, 0.18, 0.12))
  for (const p of [-75, 75]) out.push(lock(1.25, deg(p), 1, 0, 0.13, 0.07))
  // Fringe: swept across the forehead, ending above the sunglasses.
  for (const p of [-38, -14, 10, 34]) out.push(lock(0.85, deg(p), 1, 0.65, 0.22, 0.12, p === 10))
  return out
}

/** Head with a short layered haircut, wraparound sunglasses and a pest-control respirator. */
function Head({ mats }: { mats: Mats }) {
  const locks = useMemo(hairLocks, [])
  return (
    // A bit big for the body (chibi style) and tipped up so the face shows to the high camera.
    <group position-y={1.97} rotation-x={-0.32} scale={1.22}>
      <group scale={[0.92, 1.05, 0.95]}>
        <mesh material={mats.skin} castShadow>
          <sphereGeometry args={[0.26, 24, 16]} />
        </mesh>
        {/* Hair: a cap tipped back so the forehead shows, with soft locks layered on top */}
        <mesh position={[0, 0.02, -0.03]} rotation-x={-0.65} material={mats.hair} castShadow>
          <sphereGeometry args={[0.275, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        </mesh>
        {locks.map((l, i) => (
          <mesh
            key={i}
            position={l.position}
            quaternion={l.quaternion}
            scale={l.scale}
            material={l.light ? mats.hairLight : mats.hair}
            castShadow
          >
            <sphereGeometry args={[1, 12, 8]} />
          </mesh>
        ))}
        {/* Sunglasses: domed red mirrored lenses in glossy black rims, a bridge, and arms that curve back to the ears */}
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.095, 0.015, 0.258]} rotation-y={s * 0.35}>
            <mesh scale={[1, 0.88, 0.35]} material={mats.lens}>
              <sphereGeometry args={[0.072, 20, 14]} />
            </mesh>
            <mesh scale={[1, 0.88, 1]} material={mats.glassesFrame} castShadow>
              <torusGeometry args={[0.074, 0.011, 8, 28]} />
            </mesh>
            {/* Light glints so the lenses read as shiny glass */}
            <mesh position={[-0.022, 0.022, 0.026]} rotation-z={0.75} material={mats.shine}>
              <capsuleGeometry args={[0.006, 0.035, 3, 6]} />
            </mesh>
            <mesh position={[0.004, 0.034, 0.024]} rotation-z={0.75} material={mats.shine}>
              <capsuleGeometry args={[0.004, 0.012, 3, 6]} />
            </mesh>
            {/* Hinge on the outer edge */}
            <mesh position={[s * 0.077, 0.012, -0.006]} material={mats.glassesFrame}>
              <boxGeometry args={[0.022, 0.022, 0.022]} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 0.03, 0.272]} material={mats.glassesFrame}>
          <torusGeometry args={[0.027, 0.009, 6, 12, Math.PI]} />
        </mesh>
        {/* Arms: arcs hugging the side of the head, mirrored for the left */}
        {[1, -1].map((s) => (
          <group key={s} scale-x={s} position-y={0.03}>
            <group rotation-y={deg(5)}>
              <mesh rotation-x={Math.PI / 2} material={mats.glassesFrame}>
                <torusGeometry args={[0.274, 0.009, 6, 18, deg(60)]} />
              </mesh>
            </group>
          </group>
        ))}
      </group>

      {/* Ears */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.235, -0.01, 0]} scale={[0.5, 1, 0.8]} material={mats.skinShade}>
          <sphereGeometry args={[0.055, 10, 8]} />
        </mesh>
      ))}

      {/* Half-face respirator, like pest control crews wear */}
      <mesh position={[0, -0.12, 0.17]} scale={[1.15, 0.75, 0.75]} material={mats.respirator} castShadow>
        <sphereGeometry args={[0.15, 18, 12]} />
      </mesh>
      {/* Exhale valve with a grille */}
      <mesh position={[0, -0.145, 0.282]} rotation-x={Math.PI / 2 - 0.2} material={mats.valve}>
        <cylinderGeometry args={[0.045, 0.05, 0.04, 14]} />
      </mesh>
      {[-0.015, 0, 0.015].map((y) => (
        <mesh key={y} position={[0, -0.145 + y, 0.304]} rotation-x={-0.2} material={mats.respirator}>
          <boxGeometry args={[0.06, 0.005, 0.004]} />
        </mesh>
      ))}
      {/* Two yellow filter cartridges, angled out to the sides */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.13, -0.13, 0.2]} rotation-y={s * 0.85}>
          <mesh position-z={0.04} rotation-x={Math.PI / 2} material={mats.filter} castShadow>
            <cylinderGeometry args={[0.068, 0.068, 0.055, 16]} />
          </mesh>
          <mesh position-z={0.068} material={mats.filterFace}>
            <circleGeometry args={[0.05, 16]} />
          </mesh>
        </group>
      ))}
      {/* Head strap, rising toward the back */}
      <mesh position-y={-0.06} rotation-x={Math.PI / 2 + 0.3} material={mats.frame}>
        <torusGeometry args={[0.255, 0.012, 6, 28]} />
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
      hair: m(COLORS.hair, 0.7),
      hairLight: m(COLORS.hairLight, 0.65),
      jacket: m(COLORS.jacket, 0.7),
      jacketDark: m(COLORS.jacketDark, 0.7),
      accent: m(COLORS.accent, 0.6),
      zip: m(COLORS.zip),
      pants: m(COLORS.pants, 0.9),
      shoes: m(COLORS.shoes, 0.5),
      sole: m(COLORS.sole),
      lens: new MeshStandardMaterial({
        color: COLORS.lens,
        roughness: 0.08,
        metalness: 0.55,
        emissive: '#4A0010',
      }),
      glassesFrame: new MeshStandardMaterial({ color: COLORS.glassesFrame, roughness: 0.25, metalness: 0.3 }),
      frame: new MeshStandardMaterial({ color: COLORS.frame, roughness: 0.5, side: DoubleSide }),
      shine: new MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.8 }),
      respirator: m(COLORS.respirator, 0.65),
      valve: m(COLORS.valve, 0.5),
      filter: m(COLORS.filter, 0.55),
      filterFace: m(COLORS.filterFace, 0.8),
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
    // The hero waits before Start and while a card, the board or the ending is open.
    const paused = isPaused(state)
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

        {/* Pockets, hem and a bunched-up hood with a collar */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.13, 1.0, 0.168]} rotation-x={-0.2} material={mats.jacketDark}>
            <boxGeometry args={[0.13, 0.1, 0.012]} />
          </mesh>
        ))}
        <mesh position-y={0.83} scale={[1, 1, 0.72]} rotation-x={Math.PI / 2} material={mats.jacketDark}>
          <torusGeometry args={[0.235, 0.03, 6, 20]} />
        </mesh>
        <mesh position-y={1.59} rotation-x={Math.PI / 2} material={mats.jacketDark}>
          <torusGeometry args={[0.11, 0.04, 8, 16]} />
        </mesh>
        <mesh position={[0, 1.52, -0.15]} rotation-x={-0.4} scale={[1, 0.8, 0.7]} material={mats.jacketDark} castShadow>
          <sphereGeometry args={[0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
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
                <cylinderGeometry args={[0.035, 0.035, 1.3, 8]} />
              </mesh>
              {/* Rubber grip */}
              <mesh position-y={0.02} material={mats.sole}>
                <cylinderGeometry args={[0.045, 0.045, 0.28, 8]} />
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

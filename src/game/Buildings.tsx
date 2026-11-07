// Buildings and props for each zone, made from simple low-poly shapes.
// Each building is drawn with its door facing +z, then turned toward its zone.

import { useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { ExtrudeGeometry, Group, Shape } from 'three'
import { BUILDINGS, NOTICE_BOARD, type ZoneId } from './world'

type V3 = [number, number, number]

const C = {
  dark: '#2B3A31',
  accent: '#5DBB8C',
  gold: '#F2C14E',
  red: '#FF7452',
  glass: '#7FCBD6',
  glassGlow: '#2A8C9E',
  wood: '#9A6544',
  woodDark: '#5A3A2A',
  plank: '#B98B5E',
  white: '#E4EDE6',
  muted: '#9BB0A2',
}

/** Zone pads are raised a little, so props standing on them sit at this height. */
const PAD_TOP = 0.12

function Block({ size, at, color, rot, glow }: { size: V3; at: V3; color: string; rot?: V3; glow?: string }) {
  return (
    <mesh position={at} rotation={rot} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        flatShading
        roughness={0.85}
        emissive={glow ?? '#000000'}
        emissiveIntensity={glow ? 0.7 : 0}
      />
    </mesh>
  )
}

function Cyl({
  r,
  h,
  at,
  color,
  rot,
  sides = 8,
  glow,
}: {
  r: number
  h: number
  at: V3
  color: string
  rot?: V3
  sides?: number
  glow?: string
}) {
  return (
    <mesh position={at} rotation={rot} castShadow receiveShadow>
      <cylinderGeometry args={[r, r, h, sides]} />
      <meshStandardMaterial
        color={color}
        flatShading
        roughness={0.8}
        emissive={glow ?? '#000000'}
        emissiveIntensity={glow ? 0.8 : 0}
      />
    </mesh>
  )
}

/**
 * Pitched roof: a triangle prism with the ridge running along x (or along z with `alongZ`, so the
 * triangle end faces the front). `width` is the ridge length. `at` is the middle of its base.
 */
function Gable({
  width,
  height,
  depth,
  at,
  color,
  alongZ,
}: {
  width: number
  height: number
  depth: number
  at: V3
  color: string
  alongZ?: boolean
}) {
  const geometry = useMemo(() => {
    const shape = new Shape()
    shape.moveTo(-depth / 2, 0)
    shape.lineTo(depth / 2, 0)
    shape.lineTo(0, height)
    shape.closePath()
    const g = new ExtrudeGeometry(shape, { depth: width, bevelEnabled: false })
    g.translate(0, 0, -width / 2)
    g.rotateY(Math.PI / 2)
    return g
  }, [width, height, depth])
  return (
    <mesh geometry={geometry} position={at} rotation-y={alongZ ? Math.PI / 2 : 0} castShadow receiveShadow>
      <meshStandardMaterial color={color} flatShading roughness={0.9} />
    </mesh>
  )
}

/** Small table with four legs. `at` is the floor spot under its middle. */
function Table({
  at,
  w = 1.4,
  d = 0.7,
  color = C.wood,
  children,
}: {
  at: V3
  w?: number
  d?: number
  color?: string
  children?: ReactNode
}) {
  const [x, y, z] = at
  return (
    <group position={[x, y, z]}>
      <Block size={[w, 0.1, d]} at={[0, 0.8, 0]} color={color} />
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <Block
            key={`${sx}${sz}`}
            size={[0.08, 0.75, 0.08]}
            at={[sx * (w / 2 - 0.1), 0.38, sz * (d / 2 - 0.1)]}
            color={C.woodDark}
          />
        )),
      )}
      <group position-y={0.85}>{children}</group>
    </group>
  )
}

/** Glass-front office for the job. */
function Office() {
  const windowsTop = [-1.65, -0.55, 0.55, 1.65]
  return (
    <>
      <Block size={[4.8, 3.6, 3.6]} at={[0, 1.8, 0]} color="#D5DED8" />
      <Block size={[4.85, 0.18, 3.65]} at={[0, 3.25, 0]} color={C.accent} />
      <Block size={[5.1, 0.25, 3.9]} at={[0, 3.72, 0]} color={C.dark} />
      <Block size={[1, 0.5, 0.8]} at={[-1.2, 4.1, -0.6]} color={C.muted} />
      {windowsTop.map((x) => (
        <Block key={x} size={[0.8, 0.75, 0.06]} at={[x, 2.5, 1.81]} color={C.glass} glow={C.glassGlow} />
      ))}
      {[-1.65, -0.55].map((x) => (
        <Block key={x} size={[0.8, 0.75, 0.06]} at={[x, 1.2, 1.81]} color={C.glass} glow={C.glassGlow} />
      ))}
      {/* Door with a little awning */}
      <Block size={[0.95, 1.7, 0.06]} at={[1.1, 0.85, 1.81]} color={C.dark} />
      <Block size={[0.06, 0.2, 0.08]} at={[1.45, 0.85, 1.86]} color={C.gold} />
      <Block size={[1.3, 0.08, 0.6]} at={[1.1, 1.85, 2.05]} color={C.accent} />

      {/* Desk with a laptop and a coffee mug outside: remote work */}
      <Table at={[-1.5, 0, 2.4]}>
        <Block size={[0.55, 0.03, 0.38]} at={[0, 0.02, 0.05]} color={C.muted} />
        <Block size={[0.55, 0.38, 0.03]} at={[0, 0.2, -0.14]} rot={[-0.2, 0, 0]} color={C.dark} glow={C.accent} />
        <Cyl r={0.07} h={0.16} at={[0.5, 0.08, 0.1]} color={C.white} />
      </Table>
      {/* Potted plant by the door */}
      <Cyl r={0.28} h={0.5} at={[2.2, 0.25, 2.2]} color={C.woodDark} sides={6} />
      <mesh position={[2.2, 0.75, 2.2]} castShadow>
        <dodecahedronGeometry args={[0.42, 0]} />
        <meshStandardMaterial color="#4E9E62" flatShading />
      </mesh>
    </>
  )
}

/** Wooden barn with a golden gear: where the contributions get made. */
function Workshop() {
  const gear = useRef<Group>(null)
  useFrame((_, dt) => {
    if (gear.current) gear.current.rotation.z += dt * 0.6
  })
  return (
    <>
      <Block size={[5, 2.6, 3.8]} at={[0, 1.3, 0]} color={C.wood} />
      <Gable width={4.3} height={1.7} depth={5.4} at={[0, 2.6, 0]} color="#6B3A2A" alongZ />
      <Block size={[5.05, 0.15, 3.85]} at={[0, 2.55, 0]} color={C.gold} />
      {/* Barn doors */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Block size={[1, 1.9, 0.06]} at={[s * 0.52, 0.95, 1.91]} color={C.woodDark} />
          <Block size={[0.08, 2.1, 0.04]} at={[s * 0.52, 0.95, 1.95]} rot={[0, 0, s * 0.48]} color={C.plank} />
        </group>
      ))}
      {/* Golden gear on the gable */}
      <group ref={gear} position={[0, 3.25, 2.18]}>
        <Cyl r={0.42} h={0.1} at={[0, 0, 0]} rot={[Math.PI / 2, 0, 0]} color={C.gold} sides={10} glow="#7A5410" />
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2
          return (
            <Block
              key={i}
              size={[0.16, 0.2, 0.1]}
              at={[Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0]}
              rot={[0, 0, a + Math.PI / 2]}
              color={C.gold}
            />
          )
        })}
        <Cyl r={0.12} h={0.14} at={[0, 0, 0.02]} rot={[Math.PI / 2, 0, 0]} color={C.woodDark} />
      </group>

      {/* Crates */}
      <Block size={[0.8, 0.8, 0.8]} at={[2.1, 0.4, 2.2]} color={C.plank} rot={[0, 0.2, 0]} />
      <Block size={[0.6, 0.6, 0.6]} at={[2.05, 1.1, 2.2]} color={C.plank} rot={[0, -0.3, 0]} />
      {/* Workbench with a toolbox and hammer */}
      <Table at={[-1.6, 0, 2.4]} color="#8A5A3C">
        <Block size={[0.5, 0.25, 0.25]} at={[-0.3, 0.13, 0]} color={C.red} />
        <Block size={[0.3, 0.04, 0.04]} at={[-0.3, 0.3, 0]} color={C.dark} />
        <Block size={[0.06, 0.06, 0.45]} at={[0.35, 0.03, 0]} rot={[0, 0.5, 0]} color={C.woodDark} />
        <Block size={[0.22, 0.1, 0.1]} at={[0.45, 0.06, -0.18]} rot={[0, 0.5, 0]} color={C.muted} />
      </Table>
    </>
  )
}

/** White lab with a glass dome and bubbling flasks: where the skills get tested. */
function TestLab() {
  const light = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (light.current) light.current.scale.setScalar(0.8 + Math.abs(Math.sin(clock.elapsedTime * 2.5)) * 0.4)
  })
  return (
    <>
      <Block size={[4.6, 2.6, 3.6]} at={[0, 1.3, 0]} color={C.white} />
      <Block size={[4.65, 0.2, 3.65]} at={[0, 2.1, 0]} color={C.accent} />
      <Block size={[4.9, 0.2, 3.9]} at={[0, 2.7, 0]} color={C.dark} />
      {/* Dome with an antenna and a blinking light */}
      <mesh position={[0.4, 2.8, -0.2]} castShadow>
        <sphereGeometry args={[1.3, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={C.glass} flatShading roughness={0.3} metalness={0.3} />
      </mesh>
      <Cyl r={0.04} h={1.2} at={[-1.6, 3.4, -0.8]} color={C.muted} sides={5} />
      <group ref={light} position={[-1.6, 4.05, -0.8]}>
        <mesh>
          <sphereGeometry args={[0.12, 8, 6]} />
          <meshBasicMaterial color={C.red} />
        </mesh>
      </group>
      {/* Windows and a glass door */}
      {[-1.5, -0.4].map((x) => (
        <Block key={x} size={[0.75, 0.75, 0.06]} at={[x, 1.25, 1.81]} color={C.glass} glow={C.glassGlow} />
      ))}
      <Block size={[1.1, 1.75, 0.06]} at={[1.2, 0.88, 1.81]} color={C.glass} glow={C.glassGlow} />
      <Block size={[0.05, 1.75, 0.08]} at={[1.2, 0.88, 1.84]} color={C.dark} />

      {/* Lab table: flasks and a monitor with a green check */}
      <Table at={[-1.5, 0, 2.4]} color={C.muted}>
        {[
          [-0.45, C.accent],
          [-0.15, C.red],
          [0.12, C.gold],
        ].map(([x, color]) => (
          <mesh key={x as number} position={[x as number, 0.17, 0.1]} castShadow>
            <coneGeometry args={[0.13, 0.32, 6]} />
            <meshStandardMaterial
              color={color as string}
              emissive={color as string}
              emissiveIntensity={0.5}
              flatShading
            />
          </mesh>
        ))}
        <Block size={[0.45, 0.32, 0.04]} at={[0.42, 0.22, -0.1]} color={C.dark} glow="#0F1712" />
        <Block size={[0.06, 0.12, 0.02]} at={[0.38, 0.2, -0.07]} rot={[0, 0, 0.7]} color={C.accent} glow={C.accent} />
        <Block size={[0.06, 0.2, 0.02]} at={[0.46, 0.23, -0.07]} rot={[0, 0, -0.6]} color={C.accent} glow={C.accent} />
      </Table>
    </>
  )
}

/** Little school with columns, a clock and a waving flag. */
function Academy() {
  const flag = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (flag.current) flag.current.rotation.y = Math.sin(clock.elapsedTime * 2) * 0.25
  })
  return (
    <>
      <Block size={[5, 2.6, 3.4]} at={[0, 1.3, -0.2]} color="#E8DFC8" />
      <Gable width={4.4} height={1.3} depth={5.4} at={[0, 2.6, 0.2]} color="#8C3B3B" alongZ />
      <Block size={[5.2, 0.2, 4.4]} at={[0, 2.55, 0.2]} color="#D9CDB0" />
      {/* Porch columns and steps */}
      {[-1.6, -0.55, 0.55, 1.6].map((x) => (
        <Cyl key={x} r={0.15} h={2.4} at={[x, 1.25, 2.0]} color={C.white} />
      ))}
      <Block size={[4, 0.15, 0.9]} at={[0, 0.08, 2.0]} color="#D9CDB0" />
      <Block size={[1, 1.7, 0.06]} at={[0, 0.85, 1.51]} color={C.woodDark} />
      {/* Clock on the front of the roof */}
      <group position={[0, 3.1, 2.41]}>
        <Cyl r={0.36} h={0.06} at={[0, 0, 0]} rot={[Math.PI / 2, 0, 0]} color={C.white} sides={12} />
        <Block size={[0.04, 0.24, 0.02]} at={[0, 0.1, 0.04]} color={C.dark} />
        <Block size={[0.18, 0.04, 0.02]} at={[0.08, 0, 0.04]} color={C.dark} />
      </group>
      {/* Flagpole */}
      <Cyl r={0.05} h={4.6} at={[2.6, 2.3, 0.9]} color={C.muted} sides={6} />
      <group ref={flag} position={[2.6, 4.25, 0.9]}>
        <Block size={[0.9, 0.55, 0.04]} at={[0.47, 0, 0]} color={C.accent} />
      </group>
      {/* Stack of books */}
      {[
        [0.12, C.red, 0.1],
        [0.32, C.gold, -0.2],
        [0.5, C.glassGlow, 0.15],
      ].map(([y, color, r]) => (
        <Block
          key={y as number}
          size={[0.7, 0.18, 0.5]}
          at={[-2.3, y as number, 2.2]}
          rot={[0, r as number, 0]}
          color={color as string}
        />
      ))}
    </>
  )
}

const BY_ZONE: Partial<Record<ZoneId, () => ReactNode>> = {
  office: Office,
  workshop: Workshop,
  testlab: TestLab,
  academy: Academy,
}

/** Board in the Welcome Zone with notes pinned to it. */
function NoticeBoard() {
  const notes: [number, number, string, number][] = [
    [-0.65, 0.25, C.white, 0.1],
    [0.15, 0.3, '#F7E58A', -0.08],
    [0.75, 0.2, C.accent, 0.12],
    [-0.4, -0.3, '#F7E58A', -0.05],
    [0.45, -0.32, C.white, 0.06],
  ]
  return (
    <group position={[NOTICE_BOARD[0], PAD_TOP, NOTICE_BOARD[1]]}>
      {[-1.05, 1.05].map((x) => (
        <Block key={x} size={[0.15, 2.4, 0.15]} at={[x, 1.2, 0]} color={C.woodDark} />
      ))}
      <Block size={[2.3, 1.45, 0.12]} at={[0, 1.55, 0]} color="#C79B6A" />
      <Block size={[2.45, 0.12, 0.16]} at={[0, 2.3, 0]} color={C.woodDark} />
      <Block size={[2.45, 0.12, 0.16]} at={[0, 0.8, 0]} color={C.woodDark} />
      <Gable width={2.6} height={0.4} depth={0.6} at={[0, 2.36, 0]} color="#6B3A2A" />
      {notes.map(([x, y, color, r], i) => (
        <group key={i} position={[x, 1.55 + y, 0.07]} rotation-z={r}>
          <mesh>
            <planeGeometry args={[0.45, 0.45]} />
            <meshStandardMaterial color={color} roughness={1} />
          </mesh>
          <mesh position={[0, 0.17, 0.01]}>
            <sphereGeometry args={[0.035, 6, 4]} />
            <meshStandardMaterial color={C.red} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export function Buildings() {
  return (
    <>
      {BUILDINGS.map((b) => {
        const Model = BY_ZONE[b.zone]
        return Model ? (
          <group key={b.zone} position={[b.position[0], 0, b.position[1]]} rotation-y={b.facing}>
            <Model />
          </group>
        ) : null
      })}
      <NoticeBoard />
    </>
  )
}

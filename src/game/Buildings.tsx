// Buildings and props for each zone, made from simple low-poly shapes.
// Each building is drawn with its door facing +z, then turned toward its zone.

import { useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, DoubleSide, Group, PlaneGeometry, SphereGeometry, SRGBColorSpace } from 'three'
import { Kit } from './kit'
import { Merged } from './Merged'
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

/** Small table with four legs, built into a Kit. `at` is the floor spot under its middle; returns the top's height. */
function kitTable(kit: Kit, at: [number, number, number], w = 1.4, d = 0.7, color = C.wood) {
  const [x, y, z] = at
  kit.box([w, 0.1, d], [x, y + 0.8, z], color)
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      kit.box([0.08, 0.75, 0.08], [x + sx * (w / 2 - 0.1), y + 0.38, z + sz * (d / 2 - 0.1)], C.woodDark, {
        layer: 'trim',
      })
  return y + 0.85
}

/** Light text on a dark panel, drawn to a canvas for signs. */
function textTexture(text: string, color: string, width = 512, height = 112, fontScale = 0.6): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = C.dark
  ctx.fillRect(0, 0, width, height)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = color
  ctx.font = `bold ${Math.round(height * fontScale)}px system-ui, sans-serif`
  ctx.fillText(text, width / 2, height / 2 + height * 0.04, width - 24)
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

const OFFICE = {
  wall: '#D5DED8',
  pillar: '#BFCAC3',
  base: '#7D8A82',
  sill: '#E9EFEB',
  frame: '#33413A',
  stone: '#A9B3AD',
}

/** Front window: dark frame, lit glass, a cross of mullions and a sill. On the +z face unless `side` is set. */
function officeWindow(kit: Kit, x: number, y: number, z: number, side = 0) {
  if (side === 0) {
    kit.box([0.86, 0.86, 0.06], [x, y, z + 0.02], OFFICE.frame)
    kit.box([0.74, 0.74, 0.04], [x, y, z + 0.05], C.glass, { layer: 'glow' })
    kit.box([0.04, 0.74, 0.03], [x, y, z + 0.08], OFFICE.frame, { layer: 'trim' })
    kit.box([0.74, 0.04, 0.03], [x, y + 0.08, z + 0.08], OFFICE.frame, { layer: 'trim' })
    kit.box([0.96, 0.06, 0.16], [x, y - 0.46, z + 0.07], OFFICE.sill, { layer: 'trim' })
  } else {
    kit.box([0.06, 0.86, 0.86], [x + side * 0.02, y, z], OFFICE.frame)
    kit.box([0.04, 0.74, 0.74], [x + side * 0.05, y, z], C.glass, { layer: 'glow' })
    kit.box([0.03, 0.74, 0.04], [x + side * 0.08, y, z], OFFICE.frame, { layer: 'trim' })
    kit.box([0.03, 0.04, 0.74], [x + side * 0.08, y + 0.08, z], OFFICE.frame, { layer: 'trim' })
    kit.box([0.16, 0.06, 0.96], [x + side * 0.07, y - 0.46, z], OFFICE.sill, { layer: 'trim' })
  }
}

/** Two-storey office with a glass entrance, rooftop machines and a remote-work desk outside. */
function buildOffice(kit: Kit) {
  // Body, base, floor bands, roof and parapet.
  kit.box([4.6, 3.4, 3.4], [0, 1.85, 0], OFFICE.wall)
  kit.box([4.9, 0.18, 3.7], [0, 0.09, 0], OFFICE.base)
  kit.box([4.66, 0.16, 3.46], [0, 1.85, 0], C.accent)
  kit.box([4.68, 0.18, 3.48], [0, 3.3, 0], C.accent)
  kit.box([4.9, 0.22, 3.7], [0, 3.62, 0], C.dark)
  for (const z of [-1.8, 1.8]) kit.box([4.9, 0.2, 0.1], [0, 3.83, z], C.dark, { layer: 'trim' })
  for (const x of [-2.4, 2.4]) kit.box([0.1, 0.2, 3.7], [x, 3.83, 0], C.dark, { layer: 'trim' })
  // Corner pillars.
  for (const x of [-2.3, 2.3]) for (const z of [-1.7, 1.7]) kit.box([0.24, 3.4, 0.24], [x, 1.85, z], OFFICE.pillar)

  // Windows: four up, two down beside the door, and two per floor on each side.
  for (const x of [-1.65, -0.55, 0.55, 1.65]) officeWindow(kit, x, 2.6, 1.7)
  for (const x of [-1.65, -0.55]) officeWindow(kit, x, 1.05, 1.7)
  for (const side of [-1, 1])
    for (const y of [1.05, 2.6]) for (const z of [-0.7, 0.7]) officeWindow(kit, side * 2.3, y, z, side)

  // Glass double door with handles, a name plaque, a wall lamp, awning on brackets, and a step.
  kit.box([1.12, 1.88, 0.06], [1.1, 1.12, 1.72], OFFICE.frame)
  for (const s of [-1, 1]) {
    kit.box([0.47, 1.68, 0.04], [1.1 + s * 0.25, 1.06, 1.76], C.glass, { layer: 'glow' })
    kit.box([0.04, 0.3, 0.05], [1.1 + s * 0.06, 1.05, 1.8], C.gold, { layer: 'trim' })
  }
  kit.box([0.42, 0.28, 0.04], [1.95, 1.55, 1.72], C.gold, { layer: 'trim' })
  kit.box([0.1, 0.16, 0.1], [0.3, 2.0, 1.75], OFFICE.frame, { layer: 'trim' })
  kit.ball(0.07, [0.3, 1.9, 1.8], '#FFE9A8', { layer: 'glow' })
  kit.box([1.55, 0.08, 0.72], [1.1, 2.18, 2.06], C.accent)
  for (const s of [-1, 1]) kit.box([0.05, 0.25, 0.05], [1.1 + s * 0.7, 2.02, 2.36], OFFICE.frame, { layer: 'trim' })
  kit.box([1.5, 0.1, 0.42], [1.1, 0.05, 2.05], OFFICE.stone)

  // Posts and board for the company name on the roof (the name itself is a separate texture).
  for (const x of [-1.7, 1.7]) kit.box([0.1, 0.6, 0.1], [x, 4.1, 1.3], C.dark)
  kit.box([5, 1.35, 0.1], [0, 4.7, 1.32], C.dark, { rot: [-0.35, 0, 0] })

  // Rooftop: two AC units with fans, and vent pipes.
  kit.box([1, 0.5, 0.8], [-1.2, 3.98, -0.6], C.muted)
  kit.cyl(0.28, 0.04, [-1.2, 4.25, -0.6], OFFICE.frame, { layer: 'trim', sides: 14 })
  for (const a of [0, Math.PI / 2])
    kit.box([0.5, 0.02, 0.06], [-1.2, 4.28, -0.6], OFFICE.pillar, { layer: 'trim', rot: [0, a + 0.4, 0] })
  kit.box([0.7, 0.4, 0.6], [0.0, 3.93, -1.0], C.muted)
  kit.box([0.72, 0.04, 0.62], [0.0, 4.15, -1.0], OFFICE.frame, { layer: 'trim' })
  for (const x of [1.4, 1.7]) {
    kit.cyl(0.07, 0.45, [x, 3.95, -1.1], OFFICE.pillar, { layer: 'trim' })
    kit.cyl(0.1, 0.05, [x, 4.2, -1.1], OFFICE.frame, { layer: 'trim' })
  }

  // Remote-work desk: laptop, mug of coffee, notebook, and a chair.
  const top = kitTable(kit, [-1.5, 0, 2.4])
  kit.within([-1.5, top, 2.4], (k) => {
    k.box([0.55, 0.03, 0.38], [0, 0.02, 0.05], C.muted, { layer: 'trim' })
    k.box([0.55, 0.38, 0.03], [0, 0.2, -0.14], C.dark, { layer: 'trim', rot: [-0.2, 0, 0] })
    k.box([0.49, 0.32, 0.01], [0, 0.2, -0.12], C.accent, { layer: 'glow', rot: [-0.2, 0, 0] })
    k.cyl(0.07, 0.16, [0.5, 0.08, 0.1], C.white, { layer: 'trim' })
    k.cyl(0.055, 0.01, [0.5, 0.16, 0.1], C.woodDark, { layer: 'trim' })
    k.ring(0.04, 0.012, [0.58, 0.09, 0.1], C.white, { layer: 'trim', arc: Math.PI })
    k.box([0.25, 0.03, 0.32], [-0.48, 0.015, 0.05], C.red, { layer: 'trim', rot: [0, 0.3, 0] })
  })
  kit.box([0.48, 0.06, 0.45], [-1.5, 0.48, 3.05], C.woodDark)
  kit.box([0.48, 0.5, 0.06], [-1.5, 0.78, 3.27], C.woodDark)
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      kit.box([0.05, 0.45, 0.05], [-1.5 + sx * 0.19, 0.23, 3.05 + sz * 0.18], C.dark, { layer: 'trim' })

  // Potted plant by the door: a pot with a rim, soil, and three clumps of leaves.
  kit.cyl(0.24, 0.5, [2.2, 0.25, 2.2], C.woodDark, { sides: 10, r2: 0.28 })
  kit.cyl(0.3, 0.06, [2.2, 0.5, 2.2], C.wood, { layer: 'trim', sides: 10 })
  kit.cyl(0.25, 0.02, [2.2, 0.52, 2.2], '#3A2A1E', { layer: 'trim', sides: 10 })
  kit.rock(0.36, [2.2, 0.85, 2.2], '#4E9E62')
  kit.rock(0.26, [2.0, 0.75, 2.35], '#3F8F55', { rot: [0.5, 0.3, 0] })
  kit.rock(0.24, [2.38, 0.78, 2.05], '#5BAA5E', { rot: [0.2, 0.8, 0.4] })
}

/** Glass-front office for the job. */
function Office() {
  const nameTexture = useMemo(() => textTexture('Resonian Inc.', '#8FD3FF', 512, 128), [])
  return (
    <>
      {/* Company name on the roof, tilted back so the camera reads it */}
      <group position={[0, 4.7, 1.35]} rotation-x={-0.35}>
        <mesh position-z={0.03}>
          <planeGeometry args={[4.8, 1.2]} />
          <meshBasicMaterial map={nameTexture} toneMapped={false} />
        </mesh>
      </group>
      <Merged build={buildOffice} />
    </>
  )
}

/** Window on the +z face (or a side face when `side` is ±1): frame, lit glass, mullions and a sill. */
function kitWindow(
  kit: Kit,
  x: number,
  y: number,
  z: number,
  { side = 0, w = 0.86, h = 0.86, frame = OFFICE.frame, sill = OFFICE.sill, glass = C.glass } = {},
) {
  const [fw, fd] = side === 0 ? [w, 0.06] : [0.06, w]
  const at = (out: number, dy = 0): [number, number, number] =>
    side === 0 ? [x, y + dy, z + out] : [x + side * out, y + dy, z]
  const size = (a: number, b: number, c: number): [number, number, number] => (side === 0 ? [a, b, c] : [c, b, a])
  kit.box([fw, h, fd], at(0.02), frame)
  kit.box(size(w - 0.12, h - 0.12, 0.04), at(0.05), glass, { layer: 'glow' })
  kit.box(size(0.04, h - 0.12, 0.03), at(0.08), frame, { layer: 'trim' })
  kit.box(size(w - 0.12, 0.04, 0.03), at(0.08, 0.06), frame, { layer: 'trim' })
  kit.box(size(w + 0.1, 0.06, 0.16), at(0.07, -h / 2 - 0.03), sill, { layer: 'trim' })
}

/** Roof shingle lines on both slopes of a gable whose ridge runs along z. */
function kitShingles(kit: Kit, halfSpan: number, height: number, baseY: number, length: number, color: string, z = 0) {
  const angle = Math.atan2(height, halfSpan)
  for (const s of [-1, 1])
    for (const f of [0.2, 0.4, 0.6, 0.8]) {
      const x = s * halfSpan * (1 - f) + s * Math.sin(angle) * 0.02
      const y = baseY + height * f + Math.cos(angle) * 0.02
      kit.box([0.08, 0.04, length], [x, y, z], color, { layer: 'trim', rot: [0, 0, -s * angle] })
    }
}

/** Wooden crate with darker edge boards, turned by `turn`. */
function kitCrate(kit: Kit, at: [number, number, number], size: number, turn: number) {
  kit.within(
    at,
    (k) => {
      k.box([size, size, size], [0, 0, 0], C.plank)
      const e = size / 2
      for (const sy of [-1, 1])
        for (const sz of [-1, 1])
          k.box([size + 0.02, 0.07, 0.07], [0, sy * (e - 0.03), sz * (e - 0.03)], C.woodDark, { layer: 'trim' })
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          k.box([0.07, size + 0.02, 0.07], [sx * (e - 0.03), 0, sz * (e - 0.03)], C.woodDark, { layer: 'trim' })
      k.box([0.06, size * 1.2, 0.03], [0, 0, e + 0.01], C.woodDark, { layer: 'trim', rot: [0, 0, 0.78] })
    },
    [0, turn, 0],
  )
}

const BARN = { wall: C.wood, seam: '#7E5236', roof: '#6B3A2A', roofLine: '#4E2A1E', stone: '#8C8C84' }

/** Plank barn with a stone base, X-braced doors, shingled roof, barrels, logs and a workbench. */
function buildWorkshop(kit: Kit) {
  kit.box([5.2, 0.25, 4], [0, 0.125, 0], BARN.stone)
  kit.box([5, 2.4, 3.8], [0, 1.45, 0], BARN.wall)
  // Plank seams on the front and sides.
  for (let x = -2.2; x <= 2.21; x += 0.4)
    if (Math.abs(x) > 1.2) kit.box([0.03, 2.3, 0.02], [x, 1.45, 1.91], BARN.seam, { layer: 'trim' })
  for (const s of [-1, 1])
    for (let z = -1.6; z <= 1.61; z += 0.4)
      kit.box([0.02, 2.3, 0.03], [s * 2.51, 1.45, z], BARN.seam, { layer: 'trim' })
  for (const x of [-2.45, 2.45]) for (const z of [-1.85, 1.85]) kit.box([0.2, 2.5, 0.2], [x, 1.4, z], C.woodDark)
  kit.box([5.1, 0.15, 3.9], [0, 2.6, 0], C.gold)
  // Roof with an overhang, a ridge cap and shingle lines.
  kit.gable(4.4, 1.7, 5.6, [0, 2.65, 0], BARN.roof, true)
  kit.box([0.22, 0.14, 4.5], [0, 4.35, 0], BARN.roofLine)
  kitShingles(kit, 2.8, 1.7, 2.65, 4.4, BARN.roofLine)
  // Barn doors: frame, two leaves with X braces and a middle rail, rail on top and ring handles.
  kit.box([2.3, 0.12, 0.08], [0, 2.22, 1.95], C.plank)
  for (const s of [-1, 1]) {
    kit.box([0.12, 2.0, 0.08], [s * 1.1, 1.2, 1.95], C.plank)
    kit.box([1, 1.9, 0.06], [s * 0.52, 1.2, 1.93], C.woodDark)
    for (const d of [-1, 1])
      kit.box([0.08, 2.05, 0.04], [s * 0.52, 1.2, 1.97], C.plank, { layer: 'trim', rot: [0, 0, d * 0.48] })
    kit.box([0.95, 0.08, 0.04], [s * 0.52, 1.2, 1.98], C.plank, { layer: 'trim' })
    kit.ring(0.06, 0.015, [s * 0.15, 1.2, 2.01], C.gold, { layer: 'trim' })
  }
  kit.box([2.6, 0.06, 0.06], [0, 2.33, 1.99], C.dark, { layer: 'trim' })
  // Lantern by the door.
  kit.box([0.04, 0.04, 0.2], [1.5, 2.0, 2.0], C.dark, { layer: 'trim' })
  kit.box([0.16, 0.22, 0.16], [1.5, 1.85, 2.1], C.dark, { layer: 'trim' })
  kit.ball(0.07, [1.5, 1.85, 2.1], '#FFD27A', { layer: 'glow' })
  // A small window with open shutters on each side.
  for (const s of [-1, 1]) {
    kitWindow(kit, s * 2.5, 1.6, 0, { side: s, w: 0.7, h: 0.7, frame: C.woodDark, sill: C.plank, glass: '#F5D79A' })
    for (const d of [-1, 1])
      kit.box([0.04, 0.72, 0.36], [s * 2.6, 1.6, d * 0.58], BARN.seam, { layer: 'trim', rot: [0, d * s * 0.5, 0] })
  }
  // Crates, barrels and a pile of logs.
  kitCrate(kit, [2.1, 0.4, 2.2], 0.8, 0.2)
  kitCrate(kit, [2.05, 1.1, 2.2], 0.6, -0.3)
  for (const [x, z] of [
    [-2.88, 1.3],
    [-2.95, 0.55],
  ]) {
    kit.cyl(0.3, 0.8, [x, 0.4, z], '#8A5A3C', { sides: 12, r2: 0.3 })
    for (const y of [0.15, 0.65]) kit.cyl(0.315, 0.05, [x, y, z], C.dark, { layer: 'trim', sides: 12 })
    kit.cyl(0.26, 0.02, [x, 0.81, z], '#6B4A30', { layer: 'trim', sides: 12 })
  }
  for (const [x, y] of [
    [-0.36, 0.18],
    [0, 0.18],
    [0.36, 0.18],
    [-0.18, 0.49],
    [0.18, 0.49],
  ]) {
    kit.cyl(0.18, 1.2, [2.95, y, -0.6 + x], '#8A5A3C', { rot: [Math.PI / 2, 0, 0], sides: 8 })
    for (const e of [-1, 1])
      kit.cyl(0.15, 0.01, [2.95, y, -0.6 + x + e * 0.605], '#D9B88A', {
        layer: 'trim',
        rot: [Math.PI / 2, 0, 0],
        sides: 8,
      })
  }
  // Workbench: toolbox, hammer and saw.
  const top = kitTable(kit, [-1.6, 0, 2.4], 1.4, 0.7, '#8A5A3C')
  kit.within([-1.6, top, 2.4], (k) => {
    k.box([0.5, 0.25, 0.25], [-0.3, 0.13, 0], C.red, { layer: 'trim' })
    k.box([0.3, 0.04, 0.04], [-0.3, 0.3, 0], C.dark, { layer: 'trim' })
    for (const x of [-0.42, -0.18]) k.box([0.03, 0.06, 0.03], [x, 0.28, 0], C.dark, { layer: 'trim' })
    k.box([0.06, 0.06, 0.45], [0.35, 0.03, 0], C.woodDark, { layer: 'trim', rot: [0, 0.5, 0] })
    k.box([0.22, 0.1, 0.1], [0.45, 0.06, -0.18], C.muted, { layer: 'trim', rot: [0, 0.5, 0] })
    k.box([0.5, 0.01, 0.14], [0.2, 0.01, 0.2], '#C9D1D6', { layer: 'trim', rot: [0, -0.2, 0] })
    k.box([0.12, 0.04, 0.1], [-0.08, 0.02, 0.26], C.red, { layer: 'trim', rot: [0, -0.2, 0] })
  })
}

/** Golden gear for the barn gable: rim, teeth, spokes and hub. Spins as one piece. */
function buildGear(kit: Kit) {
  const flat: [number, number, number] = [Math.PI / 2, 0, 0]
  kit.ring(0.36, 0.07, [0, 0, 0], C.gold)
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2
    kit.box([0.14, 0.16, 0.1], [Math.cos(a) * 0.47, Math.sin(a) * 0.47, 0], C.gold, { rot: [0, 0, a + Math.PI / 2] })
  }
  for (let i = 0; i < 3; i++) kit.box([0.06, 0.7, 0.06], [0, 0, 0], '#D9A630', { rot: [0, 0, (i / 3) * Math.PI] })
  kit.cyl(0.12, 0.14, [0, 0, 0.02], C.woodDark, { rot: flat, sides: 10 })
  kit.cyl(0.05, 0.16, [0, 0, 0.03], C.gold, { layer: 'trim', rot: flat, sides: 8 })
}

/** Wooden barn with a golden gear: where the contributions get made. */
function Workshop() {
  const gear = useRef<Group>(null)
  useFrame((_, dt) => {
    if (gear.current) gear.current.rotation.z += dt * 0.6
  })
  return (
    <>
      <Merged build={buildWorkshop} />
      <group ref={gear} position={[0, 3.25, 2.27]}>
        <Merged build={buildGear} />
      </group>
    </>
  )
}

const LAB = { wall: C.white, base: '#A9B3AD', pillar: '#C9D6CF', metal: '#9BB0A2' }

/** White lab with a glass dome, telescope, satellite dish, pipes and a table of glowing experiments. */
function buildTestLab(kit: Kit) {
  kit.box([4.8, 0.2, 3.8], [0, 0.1, 0], LAB.base)
  kit.box([4.6, 2.4, 3.6], [0, 1.4, 0], LAB.wall)
  kit.box([4.65, 0.2, 3.65], [0, 2.1, 0], C.accent)
  kit.box([4.9, 0.2, 3.9], [0, 2.7, 0], C.dark)
  for (const z of [-1.9, 1.9]) kit.box([4.9, 0.16, 0.1], [0, 2.88, z], C.dark, { layer: 'trim' })
  for (const x of [-2.4, 2.4]) kit.box([0.1, 0.16, 3.9], [x, 2.88, 0], C.dark, { layer: 'trim' })
  for (const x of [-2.25, 2.25]) for (const z of [-1.75, 1.75]) kit.box([0.22, 2.5, 0.22], [x, 1.35, z], LAB.pillar)

  // Observatory dome with ribs, a base ring and a telescope poking out.
  kit.add(new SphereGeometry(1.3, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), C.glass, [0.4, 2.8, -0.2])
  for (const a of [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4])
    kit.ring(1.31, 0.03, [0.4, 2.8, -0.2], LAB.metal, { layer: 'trim', arc: Math.PI, rot: [0, a, 0] })
  kit.ring(1.32, 0.06, [0.4, 2.82, -0.2], C.dark, { rot: [Math.PI / 2, 0, 0] })
  kit.cyl(0.12, 1.1, [1.05, 3.75, -0.2], C.dark, { rot: [0, 0, -0.85], r2: 0.09 })
  kit.cyl(0.13, 0.08, [1.47, 4.13, -0.2], C.gold, { layer: 'trim', rot: [0, 0, -0.85] })

  // Satellite dish on the front corner of the roof.
  kit.cyl(0.05, 0.4, [-1.7, 3.0, 1.2], LAB.metal, { layer: 'trim' })
  kit.cyl(0.05, 0.15, [-1.7, 3.28, 1.25], '#E9EFEB', { r2: 0.42, sides: 16, rot: [0.6, 0, 0] })
  kit.cyl(0.02, 0.4, [-1.7, 3.46, 1.37], LAB.metal, { layer: 'trim', rot: [0.6, 0, 0] })
  kit.ball(0.04, [-1.7, 3.63, 1.49], C.red, { layer: 'glow' })

  // Windows on the front and sides.
  for (const x of [-1.5, -0.4]) kitWindow(kit, x, 1.35, 1.8, { w: 0.8, h: 0.8 })
  for (const s of [-1, 1]) kitWindow(kit, s * 2.3, 1.35, 0, { side: s, w: 0.8, h: 0.8 })

  // Glass door with a frame, handle, a gold plaque and a light above.
  kit.box([1.2, 1.85, 0.06], [1.2, 1.05, 1.81], OFFICE.frame)
  kit.box([1.04, 1.7, 0.04], [1.2, 1.0, 1.85], C.glass, { layer: 'glow' })
  kit.box([0.05, 1.7, 0.05], [1.2, 1.0, 1.88], OFFICE.frame, { layer: 'trim' })
  kit.box([0.04, 0.3, 0.05], [1.32, 1.0, 1.91], C.gold, { layer: 'trim' })
  kit.box([0.6, 0.18, 0.04], [1.2, 2.18, 1.82], C.gold, { layer: 'trim' })
  kit.cyl(0.08, 0.06, [1.95, 1.9, 1.84], '#FFF4C2', { layer: 'glow', rot: [Math.PI / 2, 0, 0] })

  // Pipes up the side wall and a roof vent.
  kit.cyl(0.07, 2.4, [2.4, 1.3, -1.2], LAB.metal, { layer: 'trim' })
  kit.cyl(0.07, 0.5, [2.2, 2.45, -1.2], LAB.metal, { layer: 'trim', rot: [0, 0, Math.PI / 2] })
  for (const y of [0.5, 1.3, 2.1]) kit.cyl(0.09, 0.06, [2.4, y, -1.2], C.dark, { layer: 'trim' })
  kit.box([0.6, 0.35, 0.5], [-1.0, 3.0, -1.2], C.muted)
  for (const y of [2.93, 3.03, 3.13]) kit.box([0.5, 0.03, 0.02], [-1.0, y, -0.94], C.dark, { layer: 'trim' })
  // Fire extinguisher by the door.
  kit.cyl(0.1, 0.5, [1.95, 0.45, 2.0], C.red, { sides: 10 })
  kit.cyl(0.04, 0.1, [1.95, 0.75, 2.0], C.dark, { layer: 'trim' })
  kit.box([0.04, 0.04, 0.18], [1.95, 0.78, 2.1], C.dark, { layer: 'trim' })

  // Lab table: glowing flasks, a rack of test tubes, a microscope and a monitor showing a green check.
  const top = kitTable(kit, [-1.5, 0, 2.4], 1.4, 0.7, C.muted)
  kit.within([-1.5, top, 2.4], (k) => {
    for (const [x, color] of [
      [-0.5, C.accent],
      [-0.22, C.red],
    ] as const) {
      k.cyl(0.13, 0.24, [x, 0.12, 0.12], color, { layer: 'glow', r2: 0.04, sides: 10 })
      k.cyl(0.035, 0.12, [x, 0.3, 0.12], '#DDEFF2', { layer: 'trim', sides: 8 })
    }
    k.box([0.4, 0.05, 0.12], [0.05, 0.03, 0.2], C.woodDark, { layer: 'trim' })
    ;[C.gold, C.accent, '#9B7BE0', C.red].forEach((color, i) =>
      k.cyl(0.025, 0.2, [-0.1 + i * 0.1, 0.12, 0.2], color, { layer: 'glow', sides: 6 }),
    )
    k.box([0.18, 0.04, 0.16], [0.05, 0.02, -0.1], C.dark, { layer: 'trim' })
    k.box([0.04, 0.22, 0.04], [0.05, 0.13, -0.16], C.dark, { layer: 'trim' })
    k.cyl(0.03, 0.18, [0.05, 0.22, -0.09], C.dark, { layer: 'trim', rot: [0.5, 0, 0] })
    k.box([0.45, 0.32, 0.04], [0.42, 0.22, -0.1], C.dark)
    k.box([0.39, 0.26, 0.01], [0.42, 0.22, -0.075], '#0F2A1C', { layer: 'glow' })
    k.box([0.06, 0.12, 0.02], [0.38, 0.2, -0.065], C.accent, { layer: 'glow', rot: [0, 0, 0.7] })
    k.box([0.06, 0.2, 0.02], [0.46, 0.23, -0.065], C.accent, { layer: 'glow', rot: [0, 0, -0.6] })
    k.box([0.05, 0.1, 0.05], [0.42, 0.04, -0.12], C.dark, { layer: 'trim' })
  })
}

/** White lab with a glass dome and bubbling flasks: where the skills get tested. */
function TestLab() {
  const light = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (light.current) light.current.scale.setScalar(0.8 + Math.abs(Math.sin(clock.elapsedTime * 2.5)) * 0.4)
  })
  return (
    <>
      <Merged build={buildTestLab} />
      {/* Antenna with a blinking light */}
      <mesh position={[-1.6, 3.4, -0.8]}>
        <cylinderGeometry args={[0.04, 0.04, 1.2, 5]} />
        <meshStandardMaterial color={C.muted} />
      </mesh>
      <group ref={light} position={[-1.6, 4.05, -0.8]}>
        <mesh>
          <sphereGeometry args={[0.12, 8, 6]} />
          <meshBasicMaterial color={C.red} />
        </mesh>
      </group>
    </>
  )
}

// Flag of Bangladesh: a red disc on bottle green, 10:6, the disc a little toward the pole.
const BD_GREEN = '#006A4E'
const BD_RED = '#F42A41'
const FLAG_W = 1
const FLAG_H = 0.6

/** Waving cloth: a flat grid whose points ripple more the further they are from the pole. */
function useFlagCloth() {
  return useMemo(() => {
    const geometry = new PlaneGeometry(FLAG_W, FLAG_H, 16, 6)
    geometry.translate(FLAG_W / 2, 0, 0)
    const rest = Float32Array.from(geometry.attributes.position.array)
    const canvas = document.createElement('canvas')
    canvas.width = 200
    canvas.height = 120
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = BD_GREEN
    ctx.fillRect(0, 0, 200, 120)
    ctx.fillStyle = BD_RED
    ctx.beginPath()
    // Disc: radius 1/5 of the length, centre at 45% of the length.
    ctx.arc(90, 60, 40, 0, Math.PI * 2)
    ctx.fill()
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    return { geometry, rest, texture }
  }, [])
}

const SCHOOL = {
  wall: '#E8DFC8',
  stone: '#B9AE94',
  trim: '#C9B993',
  roof: '#8C3B3B',
  roofLine: '#6A2A2A',
  cream: '#F2EAD6',
}

/** Book with page edges showing on the open side. */
function kitBook(kit: Kit, at: [number, number, number], w: number, h: number, d: number, color: string, turn: number) {
  kit.within(
    at,
    (k) => {
      k.box([w, h, d], [0, 0, 0], color)
      k.box([w - 0.06, h - 0.05, d + 0.01], [0.02, 0, 0], SCHOOL.cream, { layer: 'trim' })
    },
    [0, turn, 0],
  )
}

/** School with a columned porch, tall windows, a clock in the gable, roof sign, flagpole and a stack of books. */
function buildAcademy(kit: Kit) {
  kit.box([5.2, 0.2, 3.6], [0, 0.1, -0.2], SCHOOL.stone)
  kit.box([5, 2.4, 3.4], [0, 1.4, -0.2], SCHOOL.wall)
  kit.box([5.05, 0.15, 3.45], [0, 0.35, -0.2], SCHOOL.trim, { layer: 'trim' })
  kit.box([5.1, 0.12, 3.5], [0, 2.48, -0.2], SCHOOL.trim)
  // Porch: platform, steps, columns with bases and tops, and its roof.
  kit.box([4.4, 0.25, 1.0], [0, 0.125, 2.0], SCHOOL.stone)
  kit.box([2.2, 0.12, 0.4], [0, 0.06, 2.68], SCHOOL.trim)
  for (const x of [-1.6, -0.55, 0.55, 1.6]) {
    kit.cyl(0.15, 2.2, [x, 1.35, 2.0], C.white, { sides: 12 })
    for (const y of [0.31, 2.39]) kit.box([0.4, 0.12, 0.4], [x, y, 2.0], SCHOOL.cream, { layer: 'trim' })
  }
  kit.box([5.2, 0.2, 4.4], [0, 2.55, 0.2], SCHOOL.trim)
  // Roof with ridge cap and tile lines; a cream gable front with a clock.
  kit.gable(4.4, 1.3, 5.4, [0, 2.6, 0.2], SCHOOL.roof, true)
  kit.box([0.18, 0.12, 4.5], [0, 3.9, 0.2], SCHOOL.roofLine)
  kitShingles(kit, 2.7, 1.3, 2.6, 4.4, SCHOOL.roofLine, 0.2)
  kit.gable(0.06, 1.0, 4.2, [0, 2.68, 2.43], SCHOOL.cream, true)
  kit.cyl(0.36, 0.06, [0, 3.1, 2.48], C.white, { rot: [Math.PI / 2, 0, 0], sides: 20 })
  kit.ring(0.37, 0.035, [0, 3.1, 2.5], C.gold, { layer: 'trim' })
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    kit.box([0.025, i % 3 ? 0.04 : 0.07, 0.02], [Math.sin(a) * 0.29, 3.1 + Math.cos(a) * 0.29, 2.52], C.dark, {
      layer: 'trim',
      rot: [0, 0, -a],
    })
  }
  kit.box([0.04, 0.22, 0.02], [0, 3.19, 2.53], C.dark, { layer: 'trim' })
  kit.box([0.16, 0.04, 0.02], [0.07, 3.1, 2.53], C.dark, { layer: 'trim' })
  // Wooden double door with panels, gold handles and a lit window above; lanterns either side.
  kit.box([1.25, 2.0, 0.06], [0, 1.2, 1.51], SCHOOL.cream)
  for (const s of [-1, 1]) {
    kit.box([0.52, 1.6, 0.05], [s * 0.27, 1.05, 1.54], C.woodDark)
    for (const y of [0.65, 1.35]) kit.box([0.36, 0.5, 0.02], [s * 0.27, y, 1.57], C.wood, { layer: 'trim' })
    kit.ball(0.035, [s * 0.07, 1.05, 1.58], C.gold, { layer: 'trim' })
    kit.box([0.12, 0.2, 0.12], [s * 0.85, 1.85, 1.6], C.dark, { layer: 'trim' })
    kit.ball(0.05, [s * 0.85, 1.85, 1.6], '#FFD27A', { layer: 'glow' })
  }
  kit.box([1.04, 0.26, 0.04], [0, 2.0, 1.55], '#F5E3B0', { layer: 'glow' })
  // Tall windows: two on the front, two on each side.
  for (const x of [-1.85, 1.85])
    kitWindow(kit, x, 1.45, 1.5, { w: 0.6, h: 1.1, frame: C.woodDark, sill: SCHOOL.cream, glass: '#F5E3B0' })
  for (const s of [-1, 1])
    for (const z of [-1.1, 0.6])
      kitWindow(kit, s * 2.5, 1.45, z, {
        side: s,
        w: 0.6,
        h: 1.1,
        frame: C.woodDark,
        sill: SCHOOL.cream,
        glass: '#F5E3B0',
      })
  // Posts and board for the SUST sign (the letters are a separate texture).
  for (const x of [-1.1, 1.1]) kit.box([0.1, 1.1, 0.1], [x, 3.8, 1.5], C.dark)
  kit.box([3.3, 1.1, 0.1], [0, 4.75, 1.52], C.dark, { rot: [-0.35, 0, 0] })
  // Flagpole on a stone base, with a gold ball on top.
  kit.cyl(0.18, 0.18, [2.6, 0.09, 0.9], SCHOOL.stone, { sides: 10 })
  kit.cyl(0.05, 4.6, [2.6, 2.3, 0.9], C.muted, { sides: 8 })
  kit.ball(0.08, [2.6, 4.65, 0.9], C.gold)
  // Stack of books with a graduation cap on top.
  kitBook(kit, [-2.3, 0.1, 2.2], 0.7, 0.18, 0.5, C.red, 0.1)
  kitBook(kit, [-2.3, 0.28, 2.2], 0.66, 0.18, 0.48, C.gold, -0.2)
  kitBook(kit, [-2.3, 0.46, 2.2], 0.62, 0.18, 0.46, C.glassGlow, 0.15)
  kit.cyl(0.13, 0.08, [-2.3, 0.59, 2.2], C.dark, { sides: 10 })
  kit.box([0.48, 0.03, 0.48], [-2.3, 0.645, 2.2], C.dark, { rot: [0, 0.6, 0] })
  kit.ball(0.03, [-2.3, 0.67, 2.2], C.gold, { layer: 'trim' })
  kit.box([0.02, 0.18, 0.02], [-2.08, 0.57, 2.3], C.gold, { layer: 'trim' })
}

/** Little school with columns, a clock, a SUST roof sign and the flag of Bangladesh. */
function Academy() {
  const cloth = useFlagCloth()
  const nameTexture = useMemo(() => textTexture('SUST', C.gold, 384, 118, 0.88), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const pos = cloth.geometry.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = cloth.rest[i * 3]
      const y = cloth.rest[i * 3 + 1]
      const k = x / FLAG_W
      pos.setZ(i, Math.sin(x * 5 - t * 4 + y * 1.5) * 0.08 * k)
    }
    pos.needsUpdate = true
    cloth.geometry.computeVertexNormals()
  })
  return (
    <>
      <Merged build={buildAcademy} />
      <group position={[0, 4.75, 1.55]} rotation-x={-0.35}>
        <mesh position-z={0.03}>
          <planeGeometry args={[3.1, 0.95]} />
          <meshBasicMaterial map={nameTexture} toneMapped={false} />
        </mesh>
      </group>
      <mesh geometry={cloth.geometry} position={[2.65, 4.2, 0.9]} castShadow>
        <meshStandardMaterial map={cloth.texture} side={DoubleSide} roughness={0.8} />
      </mesh>
    </>
  )
}

const BY_ZONE: Partial<Record<ZoneId, () => ReactNode>> = {
  office: Office,
  workshop: Workshop,
  testlab: TestLab,
  academy: Academy,
}

/** Welcome Zone notice board: log posts, framed cork board under a little shingled roof, pinned notes and a chalk ledge. */
function buildNoticeBoard(kit: Kit) {
  for (const x of [-1.05, 1.05]) kit.cyl(0.09, 2.5, [x, 1.25, 0], C.woodDark, { sides: 8 })
  kit.box([2.3, 1.45, 0.1], [0, 1.55, 0], '#C79B6A')
  kit.box([2.45, 0.12, 0.16], [0, 2.3, 0], C.woodDark)
  kit.box([2.45, 0.12, 0.16], [0, 0.8, 0], C.woodDark)
  for (const x of [-1.17, 1.17]) kit.box([0.1, 1.6, 0.16], [x, 1.55, 0], C.woodDark)
  // Cork speckles.
  for (let i = 0; i < 14; i++) {
    const x = Math.sin(i * 12.9898) * 0.95
    const y = Math.sin(i * 78.233) * 0.6
    kit.box([0.04, 0.04, 0.01], [x, 1.55 + y, 0.055], '#A97E52', { layer: 'trim' })
  }
  kit.gable(2.7, 0.4, 0.7, [0, 2.36, 0], '#6B3A2A')
  for (const s of [-1, 1])
    kit.box([2.7, 0.03, 0.06], [0, 2.52, s * 0.17], '#4E2A1E', { layer: 'trim', rot: [s * 0.85, 0, 0] })
  // Notes with pins.
  const notes: [number, number, string, number][] = [
    [-0.65, 0.25, C.white, 0.1],
    [0.15, 0.3, '#F7E58A', -0.08],
    [0.75, 0.2, C.accent, 0.12],
    [-0.4, -0.3, '#F7E58A', -0.05],
    [0.45, -0.32, C.white, 0.06],
  ]
  for (const [x, y, color, r] of notes)
    kit.within(
      [x, 1.55 + y, 0.06],
      (k) => {
        k.box([0.45, 0.45, 0.01], [0, 0, 0], color, { layer: 'trim' })
        for (const l of [0.05, -0.05, -0.15]) k.box([0.3, 0.02, 0.005], [0, l, 0.008], '#8A8F8C', { layer: 'trim' })
        k.ball(0.035, [0, 0.17, 0.02], C.red, { layer: 'trim' })
      },
      [0, 0, r],
    )
  // Chalk ledge.
  kit.box([1.6, 0.05, 0.16], [0, 0.88, 0.1], C.wood, { layer: 'trim' })
  kit.box([0.12, 0.03, 0.03], [0.4, 0.92, 0.12], C.white, { layer: 'trim' })
  kit.box([0.1, 0.03, 0.03], [0.6, 0.92, 0.1], '#F7E58A', { layer: 'trim' })
}

function NoticeBoard() {
  return (
    <group position={[NOTICE_BOARD[0], PAD_TOP, NOTICE_BOARD[1]]}>
      <Merged build={buildNoticeBoard} />
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

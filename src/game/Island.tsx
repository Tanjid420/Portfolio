import { useLayoutEffect, useMemo, useRef } from 'react'
import {
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Euler,
  Float32BufferAttribute,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  RingGeometry,
  Shape,
  SRGBColorSpace,
  Vector3,
} from 'three'
import { HIDDEN_BUGS } from './hidden'
import { Kit } from './kit'
import { Merged } from './Merged'
import {
  BUILDINGS,
  coastRadius,
  MAGNIFIER_SPOT,
  isOnIsland,
  MOUNTAINS,
  NOTICE_BOARD,
  PATH_POINTS,
  seededRandom,
  setScatterObstacles,
  ZONES,
  type Zone,
} from './world'

const COLORS = {
  grass: '#326A47', // plan says #2E5E3E; a little lighter than that so the 3D lighting doesn't make it muddy
  cliff: '#1E3D2A',
  sand: '#E3D3A8',
  rock: '#6B7A72',
  path: '#B9A57A',
  pad: '#468A5E',
  accent: '#5DBB8C',
  gold: '#F2C14E',
  trunk: '#6B4F3A',
  sign: '#17221B',
  signText: '#E4EDE6',
  signMuted: '#9BB0A2',
}

const GRASS_DEPTH = 1.6
export const BEACH_TOP = -0.9
export const WATER_Y = -1.15

/** Flat island outline, `extra` units wider than the grass edge. */
export function islandShape(extra: number, segments = 64): Shape {
  const shape = new Shape()
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2
    const r = coastRadius(a) + extra
    // Shape is drawn in XY, then rotated flat: shape y becomes world -z.
    const x = r * Math.cos(a)
    const y = -r * Math.sin(a)
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  return shape
}

function Slab({ extra, top, depth, colors }: { extra: number; top: number; depth: number; colors: string[] }) {
  const shape = useMemo(() => islandShape(extra), [extra])
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={top - depth} receiveShadow castShadow>
      <extrudeGeometry args={[shape, { depth, bevelEnabled: false }]} />
      {/* Extrude groups: 0 = top/bottom caps, 1 = sides */}
      {colors.map((c, i) => (
        <meshStandardMaterial key={i} attach={`material-${i}`} color={c} flatShading roughness={0.95} />
      ))}
    </mesh>
  )
}

/** Points along the path, used to draw it and to keep trees off it. */
function usePathSamples(count = 240): Vector3[] {
  return useMemo(() => {
    const curve = new CatmullRomCurve3(PATH_POINTS.map(([x, z]) => new Vector3(x, 0, z)))
    return curve.getSpacedPoints(count)
  }, [count])
}

function Path({ samples, width = 2.2 }: { samples: Vector3[]; width?: number }) {
  const geometry = useMemo(() => {
    const pos: number[] = []
    const idx: number[] = []
    samples.forEach((p, i) => {
      const next = samples[Math.min(i + 1, samples.length - 1)]
      const prev = samples[Math.max(i - 1, 0)]
      const dx = next.x - prev.x
      const dz = next.z - prev.z
      const len = Math.hypot(dx, dz) || 1
      const nx = (-dz / len) * (width / 2)
      const nz = (dx / len) * (width / 2)
      pos.push(p.x + nx, 0.03, p.z + nz, p.x - nx, 0.03, p.z - nz)
      if (i > 0) {
        const a = (i - 1) * 2
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      }
    })
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    return g
  }, [samples, width])

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial color={COLORS.path} roughness={1} polygonOffset polygonOffsetFactor={-1} side={2} />
    </mesh>
  )
}

const WOOD = {
  plank: ['#B07D4F', '#A87447', '#B8864F'],
  dark: '#6E4A2C',
  post: '#7A5232',
  end: '#D9B88A',
  roof: '#6B3A2A',
}

/** Wooden sign face: three planks with grain, knots and nails, and the zone name carved in. */
function signTexture(zone: Zone): CanvasTexture {
  const W = 768
  const H = 384
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const rand = seededRandom(zone.name.length * 97 + zone.position[0] * 13)
  const plankH = H / 3
  for (let i = 0; i < 3; i++) {
    const y0 = i * plankH
    ctx.fillStyle = WOOD.plank[i]
    ctx.fillRect(0, y0, W, plankH)
    // Grain: long, gently wavy lines.
    for (let g = 0; g < 9; g++) {
      const gy = y0 + 6 + rand() * (plankH - 12)
      ctx.strokeStyle = `rgba(70, 40, 20, ${0.12 + rand() * 0.15})`
      ctx.lineWidth = 1 + rand() * 1.5
      ctx.beginPath()
      ctx.moveTo(0, gy)
      for (let x = 0; x <= W; x += 32) ctx.lineTo(x, gy + Math.sin(x * 0.02 + g) * (1 + rand() * 2))
      ctx.stroke()
    }
    // A knot.
    ctx.fillStyle = 'rgba(80, 48, 24, 0.45)'
    ctx.beginPath()
    ctx.ellipse(40 + rand() * (W - 80), y0 + plankH / 2, 9 + rand() * 6, 5 + rand() * 3, 0, 0, Math.PI * 2)
    ctx.fill()
    // Seam and nails.
    ctx.fillStyle = 'rgba(50, 30, 15, 0.7)'
    ctx.fillRect(0, y0 + plankH - 2, W, 3)
    for (const nx of [14, W - 14]) {
      ctx.beginPath()
      ctx.arc(nx, y0 + plankH / 2, 3.5, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const INK = '#000000'
  const MAX_W = W - 80
  /**
   * Carved look: a faint light edge under bold black letters, outlined to thicken them.
   * Smaller text (long titles) gets a thicker outline so every board reads equally bold.
   */
  const carve = (text: string, y: number, size: number) => {
    ctx.font = `900 ${size}px system-ui, sans-serif`
    ctx.lineJoin = 'round'
    ctx.fillStyle = 'rgba(255, 236, 205, 0.35)'
    ctx.fillText(text, W / 2 + 1.5, y + 3)
    ctx.strokeStyle = INK
    ctx.lineWidth = size < 130 ? 5 : 3
    ctx.strokeText(text, W / 2, y)
    ctx.fillStyle = INK
    ctx.fillText(text, W / 2, y)
  }
  /** Biggest font size (up to `max`) at which `text` fits the board. */
  const fit = (text: string, max: number) => {
    let size = max
    ctx.font = `900 ${size}px system-ui, sans-serif`
    while (size > 40 && ctx.measureText(text).width > MAX_W) {
      size -= 4
      ctx.font = `900 ${size}px system-ui, sans-serif`
    }
    return size
  }
  // The CV section title, as big as fits, centred on the board.
  // Long titles break onto two lines rather than shrink too far.
  const title = zone.section
  const words = title.split(' ')
  const two = words.length > 1 && fit(title, 160) < 110
  const lines = two
    ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')]
    : [title]
  const size = Math.min(...lines.map((l) => fit(l, two ? 120 : 160)))
  const step = size * 1.02
  const top = H / 2 - (step * (lines.length - 1)) / 2 + size * 0.04
  lines.forEach((line, i) => carve(line, top + i * step, size))
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

/** Zone signs are drawn at this fraction of their original size. */
const SIGN = 0.72
/** Boards with long titles are a little bigger so the words stay readable. */
const SIGN_SIZE: Partial<Record<Zone['id'], number>> = { workshop: 0.86 }
const signSize = (zone: Zone) => SIGN_SIZE[zone.id] ?? SIGN

/** Zone pad, its coloured ring, and a wooden sign on log posts with a little roof. */
function buildZoneSpot(kit: Kit, zone: Zone) {
  const [x, z] = zone.position
  kit.cyl(zone.radius + 0.2, 0.12, [x, 0.06, z], COLORS.pad, { r2: zone.radius, sides: 12 })
  kit.add(
    new RingGeometry(zone.radius - 0.3, zone.radius, 12),
    zone.id === 'workshop' ? COLORS.gold : COLORS.accent,
    [x, 0.125, z],
    {
      rot: [-Math.PI / 2, 0, 0],
    },
  )
  const [sx, sz] = signSpot(zone)
  const k = signSize(zone)
  kit.within([sx, 0, sz], (kk) => {
    for (const px of [-2.45 * k, 2.45 * k]) {
      kk.cyl(0.13 * k, 3.6 * k, [px, 1.8 * k, -0.15 * k], WOOD.post, { sides: 8 })
      kk.cyl(0.11 * k, 0.02, [px, 3.6 * k + 0.01, -0.15 * k], WOOD.end, { layer: 'trim', sides: 8 })
    }
    kk.within(
      [0, 2.6 * k, 0.15 * k],
      (b) => {
        b.box([5.2 * k, 2.6 * k, 0.12], [0, 0, 0], WOOD.dark)
        for (const y of [-1.38 * k, 1.38 * k]) b.box([5.6 * k, 0.2 * k, 0.18], [0, y, 0.02], WOOD.post)
        for (const x2 of [-2.7 * k, 2.7 * k]) b.box([0.2 * k, 2.95 * k, 0.18], [x2, 0, 0.02], WOOD.post)
        for (const cx of [-2.7 * k, 2.7 * k])
          for (const cy of [-1.38 * k, 1.38 * k]) b.ball(0.05, [cx, cy, 0.12], COLORS.sign, { layer: 'trim' })
        b.gable(5.9 * k, 0.35 * k, 0.55 * k, [0, 1.48 * k, 0], WOOD.roof)
      },
      [-0.35, 0, 0],
    )
  })
}

/**
 * Where each sign stands, as an offset from its zone centre in zone radii.
 * Most stand at the front-left of the pad; the Office sign stands on the right, where trees don't hide it.
 */
const SIGN_OFFSET: Partial<Record<Zone['id'], [number, number]>> = { office: [1.1, 0] }

function signSpot(zone: Zone): [number, number] {
  const [ox, oz] = SIGN_OFFSET[zone.id] ?? [-0.72, 0.72]
  return [zone.position[0] + zone.radius * ox, zone.position[1] + zone.radius * oz]
}

function ZoneSpot({ zone }: { zone: Zone }) {
  const texture = useMemo(() => signTexture(zone), [zone])
  const build = useMemo(() => (kit: Kit) => buildZoneSpot(kit, zone), [zone])
  const [sx, sz] = signSpot(zone)
  const k = signSize(zone)
  return (
    <group>
      <Merged build={build} />
      <group position={[sx, 2.6 * k, sz + 0.15 * k]} rotation-x={-0.35}>
        <mesh position-z={0.07}>
          <planeGeometry args={[5.0 * k, 2.4 * k]} />
          <meshBasicMaterial map={texture} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

/** One draw call for many copies of the same mesh, each with its own tint if `colors` is given. */
function Instanced({
  geometry,
  material,
  matrices,
  colors,
}: {
  geometry: BufferGeometry
  material: MeshStandardMaterial
  matrices: Matrix4[]
  colors?: Color[]
}) {
  const ref = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m))
    colors?.forEach((c, i) => mesh.setColorAt(i, c))
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [matrices, colors])
  return <instancedMesh ref={ref} args={[geometry, material, matrices.length]} castShadow receiveShadow />
}

/** Rugged peak: a cone with every corner pushed around, coloured moss at the foot, rock, and snow on tall tops. */
function mountainGeometry(r: number, h: number, seed: number, snow: boolean): BufferGeometry {
  const g = new ConeGeometry(r, h, 11, 6)
  g.translate(0, h / 2, 0)
  const p = g.attributes.position
  const moss = new Color('#4F7A55')
  const rockDark = new Color('#5E6B64')
  const rockLight = new Color('#8A958E')
  const white = new Color('#F2F4F2')
  const c = new Color()
  const colors: number[] = []
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const y = p.getY(i)
    const z = p.getZ(i)
    const f = y / h
    const key = [Math.round(x * 50), Math.round(y * 50), Math.round(z * 50)] as const
    const n = hash3(...key, seed)
    const n2 = hash3(key[2], key[0], key[1], seed + 7)
    if (f < 0.999) {
      // Ridges and gullies: push corners in and out, less near the peak so it stays pointed.
      const k = 1 + (n - 0.5) * 0.45 * (1 - f * 0.6)
      const lift = f > 0.01 ? (n2 - 0.5) * h * 0.08 : 0
      p.setXYZ(i, x * k, y + lift, z * k)
    }
    const shade = f + (n2 - 0.5) * 0.15
    if (shade < 0.12) c.lerpColors(moss, rockDark, shade / 0.12)
    else c.lerpColors(rockDark, rockLight, Math.min((shade - 0.12) / 0.6, 1))
    if (snow && shade > 0.74) c.copy(white)
    colors.push(c.r, c.g, c.b)
  }
  g.setAttribute('color', new Float32BufferAttribute(colors, 3))
  g.computeVertexNormals()
  return g
}

function Mountains() {
  const { peaks, boulders } = useMemo(() => {
    const rand = seededRandom(4242)
    const peaks: { geometry: BufferGeometry; position: [number, number, number]; rotation: number }[] = []
    const boulders: Matrix4[] = []
    const q = new Quaternion()
    const e = new Euler()
    MOUNTAINS.forEach(([x, z, r, h], i) => {
      const tall = h >= 6
      peaks.push({ geometry: mountainGeometry(r, h, i * 13 + 1, tall), position: [x, -0.2, z], rotation: i * 1.3 })
      // Two lower shoulder peaks inside the footprint, so walking around the mountain still works.
      const a = rand() * Math.PI * 2
      for (const [turn, dist, rs, hs] of [
        [0, 0.42, 0.55, 0.62],
        [2.3, 0.45, 0.48, 0.45],
      ]) {
        const sh = h * hs
        peaks.push({
          geometry: mountainGeometry(r * rs, sh, i * 13 + 5 + turn, tall && sh >= 5),
          position: [x + Math.cos(a + turn) * r * dist, -0.2, z + Math.sin(a + turn) * r * dist],
          rotation: rand() * Math.PI,
        })
      }
      // Fallen boulders round the foot.
      for (let k = 0; k < 5; k++) {
        const ba = rand() * Math.PI * 2
        const br = r * (0.82 + rand() * 0.12)
        const s = 0.35 + rand() * 0.4
        q.setFromEuler(e.set(rand() * 3, rand() * 3, rand() * 3))
        boulders.push(
          new Matrix4().compose(
            new Vector3(x + Math.cos(ba) * br, s * 0.4, z + Math.sin(ba) * br),
            q,
            new Vector3(s, s * 0.7, s),
          ),
        )
      }
    })
    return { peaks, boulders }
  }, [])
  const mats = useMemo(
    () => ({
      peak: new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }),
      boulder: new MeshStandardMaterial({ color: COLORS.rock, flatShading: true, roughness: 1 }),
      boulderGeo: new DodecahedronGeometry(1, 0),
    }),
    [],
  )
  return (
    <>
      {peaks.map((pk, i) => (
        <mesh
          key={i}
          geometry={pk.geometry}
          material={mats.peak}
          position={pk.position}
          rotation-y={pk.rotation}
          castShadow
          receiveShadow
        />
      ))}
      <Instanced geometry={mats.boulderGeo} material={mats.boulder} matrices={boulders} />
    </>
  )
}

/** Same-ish noise for the same point, so shared corners of a mesh move together and it stays closed. */
function hash3(x: number, y: number, z: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed) * 43758.5453
  return n - Math.floor(n)
}

/** Lumpy ball for leaf clumps and bushes: a sphere with every corner pushed in or out a little. */
function blobGeometry(seed: number): BufferGeometry {
  const g = new IcosahedronGeometry(1, 1)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const y = p.getY(i)
    const z = p.getZ(i)
    const k = 0.8 + 0.35 * hash3(Math.round(x * 100), Math.round(y * 100), Math.round(z * 100), seed)
    // Flatter underside, like a real canopy.
    p.setXYZ(i, x * k, (y < 0 ? y * 0.65 : y) * k, z * k)
  }
  g.computeVertexNormals()
  return g
}

/** Pine tier: a cone with a ragged edge and a slightly drooping rim. */
function pineTierGeometry(seed: number): BufferGeometry {
  const g = new ConeGeometry(1, 1.3, 9, 2)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const y = p.getY(i)
    const z = p.getZ(i)
    const r = Math.hypot(x, z)
    if (r < 1e-3) continue
    const k = 0.8 + 0.4 * hash3(Math.round(x * 100), Math.round(y * 100), Math.round(z * 100), seed)
    p.setXYZ(i, x * k, y - (r > 0.9 ? 0.12 * k : 0), z * k)
  }
  g.computeVertexNormals()
  return g
}

const BROADLEAF = ['#4E9E62', '#5BAA5E', '#3F8F55', '#6DB062', '#8DB85A']
const PINE = ['#2F7048', '#3A7D50', '#336B45', '#2C6342']
const BUSH = ['#4A9459', '#5FA762', '#3E8650']

/** Seeded scatter of trees, bushes and rocks that keeps clear of zones, the path and mountains. */
function useScatter(samples: Vector3[]) {
  return useMemo(() => {
    const rand = seededRandom(7298)
    // Spots that need open ground around them: buildings, Welcome props and hidden bugs. [x, z, radius]
    const keepClear: [number, number, number][] = [
      ...BUILDINGS.map((b): [number, number, number] => [...b.position, b.radius + 1.5]),
      [...NOTICE_BOARD, 1.5],
      [...MAGNIFIER_SPOT, 1.5],
      ...HIDDEN_BUGS.map((h): [number, number, number] => [...h.position, 2.5]),
    ]
    const isClear = (x: number, z: number, gap: number) => {
      if (!isOnIsland(x, z, 2.5)) return false
      if (ZONES.some((zn) => Math.hypot(x - zn.position[0], z - zn.position[1]) < zn.radius + gap)) return false
      if (MOUNTAINS.some(([mx, mz, mr]) => Math.hypot(x - mx, z - mz) < mr + 0.8)) return false
      if (keepClear.some(([cx, cz, cr]) => Math.hypot(x - cx, z - cz) < cr + gap * 0.5)) return false
      return samples.every((p) => Math.hypot(x - p.x, z - p.z) > 2.2 + gap * 0.3)
    }

    const tint = (list: string[], spread = 0.06) => {
      const c = new Color(list[Math.floor(rand() * list.length)])
      c.offsetHSL((rand() - 0.5) * 0.02, 0, (rand() - 0.5) * spread)
      return c
    }

    const tree = new Matrix4()
    const local = new Matrix4()
    const q = new Quaternion()
    const e = new Euler()
    const v = new Vector3()
    const sc = new Vector3()
    /** Puts a part at `offset` inside the current tree, with its own tilt and size. */
    const part = (list: Matrix4[], offset: [number, number, number], size: [number, number, number], tilt = 0) => {
      q.setFromEuler(e.set((rand() - 0.5) * tilt, rand() * Math.PI * 2, (rand() - 0.5) * tilt))
      local.compose(v.set(...offset), q, sc.set(...size))
      list.push(tree.clone().multiply(local))
    }

    const trunks: Matrix4[] = []
    const blobs: Matrix4[] = []
    const blobColors: Color[] = []
    const tiers: Matrix4[] = []
    const tierColors: Color[] = []
    const bushes: Matrix4[] = []
    const bushColors: Color[] = []
    const rocks: Matrix4[] = []
    const obstacles: [number, number, number][] = []

    for (let tries = 0; tries < 600 && trunks.length < 70; tries++) {
      const x = (rand() * 2 - 1) * 40
      const z = (rand() * 2 - 1) * 40
      if (!isClear(x, z, 2)) continue
      const s = 0.8 + rand() * 0.5
      tree.compose(v.set(x, 0, z), q.setFromEuler(e.set(0, rand() * Math.PI * 2, 0)), sc.setScalar(s))
      obstacles.push([x, z, 0.35 * s])
      // More pines up north by the mountains, more round trees down south.
      const pine = rand() < (z < -8 ? 0.7 : 0.3)
      if (pine) {
        const h = 1 + rand() * 0.25
        part(trunks, [0, 0.8, 0], [0.75, 1.6, 0.75], 0.05)
        const tierCount = 4
        for (let i = 0; i < tierCount; i++) {
          const r = 1.35 - i * 0.28
          part(tiers, [0, (1.25 + i * 0.75) * h, 0], [r, 1 + (i === tierCount - 1 ? 0.3 : 0), r], 0.15)
          tierColors.push(tint(PINE, 0.05))
        }
      } else {
        part(trunks, [0, 0.9, 0], [1, 1.8, 1], 0.12)
        const base = tint(BROADLEAF)
        const clumps: [number, number, number, number][] = [
          [0, 2.5, 0, 1.25],
          [0.75, 2.15, 0.2, 0.85],
          [-0.6, 2.2, -0.35, 0.9],
          [0.1, 2.25, 0.75, 0.8],
          [0.15, 3.2, -0.1, 0.85],
        ]
        clumps.forEach(([cx, cy, cz, cr], i) => {
          const r = cr * (0.85 + rand() * 0.3)
          part(blobs, [cx, cy, cz], [r, r * 0.9, r], 1)
          // Top clumps catch more light.
          blobColors.push(base.clone().offsetHSL(0, 0, i === 4 ? 0.05 : (rand() - 0.5) * 0.06))
        })
      }
    }

    for (let tries = 0; tries < 300 && bushes.length < 30; tries++) {
      const x = (rand() * 2 - 1) * 40
      const z = (rand() * 2 - 1) * 40
      if (!isClear(x, z, 1)) continue
      tree.compose(v.set(x, 0, z), q.identity(), sc.setScalar(0.5 + rand() * 0.4))
      part(bushes, [0, 0.35, 0], [1, 0.8, 1], 0.4)
      bushColors.push(tint(BUSH))
      if (rand() < 0.5) {
        part(bushes, [0.7, 0.25, 0.2], [0.65, 0.55, 0.65], 0.4)
        bushColors.push(tint(BUSH))
      }
    }

    for (let tries = 0; tries < 300 && rocks.length < 18; tries++) {
      const x = (rand() * 2 - 1) * 40
      const z = (rand() * 2 - 1) * 40
      if (!isClear(x, z, 1)) continue
      q.setFromEuler(e.set(rand() * 3, rand() * 3, rand() * 3))
      sc.set(0.5 + rand() * 0.7, 0.4 + rand() * 0.4, 0.5 + rand() * 0.7)
      obstacles.push([x, z, 0.8 * Math.max(sc.x, sc.z)])
      rocks.push(new Matrix4().compose(v.set(x, 0.2, z), q, sc))
    }

    setScatterObstacles(obstacles)
    return { trunks, blobs, blobColors, tiers, tierColors, bushes, bushColors, rocks }
  }, [samples])
}

export function Island() {
  const samples = usePathSamples()
  const scatter = useScatter(samples)

  const parts = useMemo(
    () => ({
      trunkGeo: new CylinderGeometry(0.12, 0.22, 1, 6),
      blobGeo: blobGeometry(3),
      tierGeo: pineTierGeometry(5),
      bushGeo: blobGeometry(11),
      rockGeo: new DodecahedronGeometry(1, 0),
      trunkMat: new MeshStandardMaterial({ color: COLORS.trunk, flatShading: true, roughness: 1 }),
      // White base so each copy's own tint shows as-is.
      leafMat: new MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 0.85 }),
      rockMat: new MeshStandardMaterial({ color: COLORS.rock, flatShading: true, roughness: 1 }),
    }),
    [],
  )

  return (
    <group>
      <Slab extra={0} top={0} depth={GRASS_DEPTH} colors={[COLORS.grass, COLORS.cliff]} />
      <Slab extra={3} top={BEACH_TOP} depth={0.6} colors={[COLORS.sand, COLORS.sand]} />
      <Path samples={samples} />
      {ZONES.map((zone) => (
        <ZoneSpot key={zone.id} zone={zone} />
      ))}
      <Mountains />
      <Instanced geometry={parts.trunkGeo} material={parts.trunkMat} matrices={scatter.trunks} />
      <Instanced
        geometry={parts.blobGeo}
        material={parts.leafMat}
        matrices={scatter.blobs}
        colors={scatter.blobColors}
      />
      <Instanced
        geometry={parts.tierGeo}
        material={parts.leafMat}
        matrices={scatter.tiers}
        colors={scatter.tierColors}
      />
      <Instanced
        geometry={parts.bushGeo}
        material={parts.leafMat}
        matrices={scatter.bushes}
        colors={scatter.bushColors}
      />
      <Instanced geometry={parts.rockGeo} material={parts.rockMat} matrices={scatter.rocks} />
    </group>
  )
}

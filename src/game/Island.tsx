import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Float32BufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Shape,
  SRGBColorSpace,
  Vector3,
} from 'three'
import { HIDDEN_BUGS } from './hidden'
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
  grass: '#3A7550', // plan says #2E5E3E; lifted because the 3D lighting made it look muddy
  cliff: '#1E3D2A',
  sand: '#E3D3A8',
  ocean: '#2A8C9E',
  foam: '#7FCBD6',
  rock: '#6B7A72',
  path: '#B9A57A',
  pad: '#468A5E',
  accent: '#5DBB8C',
  gold: '#F2C14E',
  leaves: '#4E9E62',
  leavesDark: '#3C8752',
  trunk: '#6B4F3A',
  sign: '#17221B',
  signText: '#E4EDE6',
  signMuted: '#9BB0A2',
}

const GRASS_DEPTH = 1.6
const BEACH_TOP = -0.9
const WATER_Y = -1.15

/** Flat island outline, `extra` units wider than the grass edge. */
function islandShape(extra: number, segments = 64): Shape {
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

function Water() {
  const foam = useRef<Mesh>(null)
  const shape = useMemo(() => islandShape(4.5), [])
  useFrame(({ clock }) => {
    if (foam.current) foam.current.position.y = WATER_Y + 0.06 + Math.sin(clock.elapsedTime * 1.2) * 0.05
  })
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position-y={WATER_Y} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color={COLORS.ocean} roughness={0.35} metalness={0.1} />
      </mesh>
      <mesh ref={foam} rotation-x={-Math.PI / 2}>
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial color={COLORS.foam} transparent opacity={0.45} roughness={0.6} />
      </mesh>
    </>
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

function signTexture(zone: Zone): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = COLORS.sign
  ctx.fillRect(0, 0, 512, 256)
  ctx.strokeStyle = zone.id === 'workshop' ? COLORS.gold : COLORS.accent
  ctx.lineWidth = 10
  ctx.strokeRect(5, 5, 502, 246)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = COLORS.signText
  ctx.font = 'bold 66px system-ui, sans-serif'
  ctx.fillText(zone.name, 256, 98, 480)
  ctx.fillStyle = COLORS.signMuted
  ctx.font = '44px system-ui, sans-serif'
  ctx.fillText(`(${zone.section})`, 256, 176, 480)
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

function ZoneSpot({ zone }: { zone: Zone }) {
  const [x, z] = zone.position
  const texture = useMemo(() => signTexture(zone), [zone])
  const ring = zone.id === 'workshop' ? COLORS.gold : COLORS.accent
  // Sign stands at the front-left of the pad, facing the camera.
  const sx = x - zone.radius * 0.72
  const sz = z + zone.radius * 0.72

  return (
    <group>
      <mesh position={[x, 0.06, z]} receiveShadow>
        <cylinderGeometry args={[zone.radius, zone.radius + 0.2, 0.12, 12]} />
        <meshStandardMaterial color={COLORS.pad} flatShading roughness={0.9} />
      </mesh>
      <mesh position={[x, 0.125, z]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[zone.radius - 0.3, zone.radius, 12]} />
        <meshStandardMaterial color={ring} roughness={0.7} />
      </mesh>
      <group position={[sx, 0, sz]}>
        <mesh position={[0, 1, 0]} castShadow>
          <boxGeometry args={[0.25, 2, 0.25]} />
          <meshStandardMaterial color={COLORS.trunk} flatShading />
        </mesh>
        <mesh position={[0, 2.6, 0.15]} rotation-x={-0.35} castShadow>
          <boxGeometry args={[5.2, 2.6, 0.15]} />
          <meshStandardMaterial attach="material-0" color={COLORS.sign} />
          <meshStandardMaterial attach="material-1" color={COLORS.sign} />
          <meshStandardMaterial attach="material-2" color={COLORS.sign} />
          <meshStandardMaterial attach="material-3" color={COLORS.sign} />
          <meshBasicMaterial attach="material-4" map={texture} toneMapped={false} />
          <meshStandardMaterial attach="material-5" color={COLORS.sign} />
        </mesh>
      </group>
    </group>
  )
}

/** One draw call for many copies of the same mesh. */
function Instanced({ geometry, material, matrices }: { geometry: BufferGeometry; material: MeshStandardMaterial; matrices: Matrix4[] }) {
  const ref = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m))
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [matrices])
  return <instancedMesh ref={ref} args={[geometry, material, matrices.length]} castShadow receiveShadow />
}

function Mountains() {
  return (
    <>
      {MOUNTAINS.map(([x, z, r, h], i) => (
        <mesh key={i} position={[x, h / 2 - 0.2, z]} rotation-y={i * 1.3} castShadow receiveShadow>
          <coneGeometry args={[r, h, 6]} />
          <meshStandardMaterial color={COLORS.rock} flatShading roughness={1} />
        </mesh>
      ))}
    </>
  )
}

/** Seeded scatter of trees and rocks that keeps clear of zones, the path and mountains. */
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

    const dummy = new Object3D()
    const trunks: Matrix4[] = []
    const lower: Matrix4[] = []
    const upper: Matrix4[] = []
    const rocks: Matrix4[] = []
    const obstacles: [number, number, number][] = []

    for (let tries = 0; tries < 600 && trunks.length < 70; tries++) {
      const x = (rand() * 2 - 1) * 40
      const z = (rand() * 2 - 1) * 40
      if (!isClear(x, z, 2)) continue
      const s = 0.8 + rand() * 0.5
      const ry = rand() * Math.PI
      const place = (y: number, list: Matrix4[]) => {
        dummy.position.set(x, y * s, z)
        dummy.rotation.set(0, ry, 0)
        dummy.scale.setScalar(s)
        dummy.updateMatrix()
        list.push(dummy.matrix.clone())
      }
      obstacles.push([x, z, 0.35 * s])
      place(0.5, trunks)
      place(1.8, lower)
      place(2.9, upper)
    }

    for (let tries = 0; tries < 300 && rocks.length < 18; tries++) {
      const x = (rand() * 2 - 1) * 40
      const z = (rand() * 2 - 1) * 40
      if (!isClear(x, z, 1)) continue
      dummy.position.set(x, 0.2, z)
      dummy.rotation.set(rand() * 3, rand() * 3, rand() * 3)
      dummy.scale.set(0.5 + rand() * 0.7, 0.4 + rand() * 0.4, 0.5 + rand() * 0.7)
      dummy.updateMatrix()
      obstacles.push([x, z, 0.8 * Math.max(dummy.scale.x, dummy.scale.z)])
      rocks.push(dummy.matrix.clone())
    }

    setScatterObstacles(obstacles)
    return { trunks, lower, upper, rocks }
  }, [samples])
}

export function Island() {
  const samples = usePathSamples()
  const { trunks, lower, upper, rocks } = useScatter(samples)

  const parts = useMemo(
    () => ({
      trunkGeo: new CylinderGeometry(0.18, 0.25, 1, 5),
      lowerGeo: new ConeGeometry(1.3, 2, 6),
      upperGeo: new ConeGeometry(0.95, 1.6, 6),
      rockGeo: new DodecahedronGeometry(1, 0),
      trunkMat: new MeshStandardMaterial({ color: COLORS.trunk, flatShading: true }),
      leavesMat: new MeshStandardMaterial({ color: COLORS.leaves, flatShading: true, roughness: 0.9 }),
      leavesDarkMat: new MeshStandardMaterial({ color: COLORS.leavesDark, flatShading: true, roughness: 0.9 }),
      rockMat: new MeshStandardMaterial({ color: COLORS.rock, flatShading: true, roughness: 1 }),
    }),
    [],
  )

  return (
    <group>
      <Slab extra={0} top={0} depth={GRASS_DEPTH} colors={[COLORS.grass, COLORS.cliff]} />
      <Slab extra={3} top={BEACH_TOP} depth={0.6} colors={[COLORS.sand, COLORS.sand]} />
      <Water />
      <Path samples={samples} />
      {ZONES.map((zone) => (
        <ZoneSpot key={zone.id} zone={zone} />
      ))}
      <Mountains />
      <Instanced geometry={parts.trunkGeo} material={parts.trunkMat} matrices={trunks} />
      <Instanced geometry={parts.lowerGeo} material={parts.leavesDarkMat} matrices={lower} />
      <Instanced geometry={parts.upperGeo} material={parts.leavesMat} matrices={upper} />
      <Instanced geometry={parts.rockGeo} material={parts.rockMat} matrices={rocks} />
    </group>
  )
}

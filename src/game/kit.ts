// Builds a whole static prop out of simple shapes, then merges them into a few meshes.
// Each shape keeps its own colour (stored per vertex), so a detailed building costs only
// about three draw calls: solid parts that cast shadows, small trim that doesn't, and glowing glass.

import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DodecahedronGeometry,
  Euler,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Matrix4,
  Quaternion,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export type V3 = [number, number, number]

/** main: casts shadows. trim: small details, no shadow. glow: lit glass and screens. */
export type Layer = 'main' | 'trim' | 'glow'

export interface PartOptions {
  rot?: V3
  layer?: Layer
}

const KEEP = new Set(['position', 'normal', 'color'])
const UP = new Vector3(0, 1, 0)

/** Tapered rod from a to b (radius r1 at a, r2 at b). */
export function rod(a: V3, b: V3, r1: number, r2: number, sides = 8): BufferGeometry {
  const from = new Vector3(...a)
  const dir = new Vector3(...b).sub(from)
  const g = new CylinderGeometry(r2, r1, dir.length(), sides)
  g.translate(0, dir.length() / 2, 0)
  g.applyQuaternion(new Quaternion().setFromUnitVectors(UP, dir.normalize()))
  g.translate(from.x, from.y, from.z)
  return g
}

export class Kit {
  private parts: Record<Layer, BufferGeometry[]> = { main: [], trim: [], glow: [] }
  /** Where `within` has moved and turned the parts being added. */
  private frame = new Matrix4()

  /** Adds any geometry, moved to `at` (plus the current offset) and turned by `rot`. */
  add(source: BufferGeometry, color: string, at: V3 = [0, 0, 0], opts: PartOptions = {}): this {
    const g = source.index ? source.toNonIndexed() : source
    const turn = new Quaternion().setFromEuler(new Euler(...(opts.rot ?? [0, 0, 0])))
    const local = new Matrix4().compose(new Vector3(...at), turn, new Vector3(1, 1, 1))
    g.applyMatrix4(this.frame.clone().multiply(local))
    const c = new Color(color)
    const colors = new Float32Array(g.attributes.position.count * 3)
    for (let i = 0; i < colors.length; i += 3) colors.set([c.r, c.g, c.b], i)
    g.setAttribute('color', new Float32BufferAttribute(colors, 3))
    // Every part must have the same attributes to merge.
    for (const name of Object.keys(g.attributes)) if (!KEEP.has(name)) g.deleteAttribute(name)
    this.parts[opts.layer ?? 'main'].push(g)
    return this
  }

  box(size: V3, at: V3, color: string, opts?: PartOptions): this {
    return this.add(new BoxGeometry(...size), color, at, opts)
  }

  /** Cylinder standing on y (turn it with `rot`). `r2` makes it taper toward the top. */
  cyl(r: number, h: number, at: V3, color: string, opts: PartOptions & { sides?: number; r2?: number } = {}): this {
    return this.add(new CylinderGeometry(opts.r2 ?? r, r, h, opts.sides ?? 10), color, at, opts)
  }

  ball(r: number, at: V3, color: string, opts?: PartOptions & { scale?: V3 }): this {
    const g = new SphereGeometry(r, 10, 8)
    if (opts?.scale) g.scale(...opts.scale)
    return this.add(g, color, at, opts)
  }

  rock(r: number, at: V3, color: string, opts?: PartOptions): this {
    return this.add(new DodecahedronGeometry(r, 0), color, at, opts)
  }

  ring(r: number, tube: number, at: V3, color: string, opts?: PartOptions & { arc?: number }): this {
    return this.add(new TorusGeometry(r, tube, 6, 14, opts?.arc ?? Math.PI * 2), color, at, opts)
  }

  /**
   * Pitched roof: a triangle prism with the ridge along x (or along z with `alongZ`, so the
   * triangle end faces the front). `width` is the ridge length. `at` is the middle of its base.
   */
  gable(width: number, height: number, depth: number, at: V3, color: string, alongZ = false, layer?: Layer): this {
    const shape = new Shape()
    shape.moveTo(-depth / 2, 0)
    shape.lineTo(depth / 2, 0)
    shape.lineTo(0, height)
    shape.closePath()
    const g = new ExtrudeGeometry(shape, { depth: width, bevelEnabled: false })
    g.translate(0, 0, -width / 2)
    g.rotateY(Math.PI / 2 + (alongZ ? Math.PI / 2 : 0))
    return this.add(g, color, at, { layer })
  }

  /** Adds parts relative to `at` and turned by `rot`, e.g. everything on a table top or on a tilted sign. */
  within(at: V3, fn: (kit: this) => void, rot: V3 = [0, 0, 0]): this {
    const saved = this.frame.clone()
    const turn = new Quaternion().setFromEuler(new Euler(...rot))
    this.frame.multiply(new Matrix4().compose(new Vector3(...at), turn, new Vector3(1, 1, 1)))
    fn(this)
    this.frame.copy(saved)
    return this
  }

  /** One merged geometry per layer that has parts. */
  build(): Partial<Record<Layer, BufferGeometry>> {
    const out: Partial<Record<Layer, BufferGeometry>> = {}
    for (const layer of Object.keys(this.parts) as Layer[]) {
      const list = this.parts[layer]
      if (!list.length) continue
      out[layer] = mergeGeometries(list)!
      list.forEach((g) => g.dispose())
    }
    return out
  }
}

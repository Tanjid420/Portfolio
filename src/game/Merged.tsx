import { useMemo } from 'react'
import { MeshStandardMaterial } from 'three'
import { Kit } from './kit'

/** Shared materials for merged props: colour comes from each part. */
const SOLID = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.82 })
const GLOW = new MeshStandardMaterial({ vertexColors: true, roughness: 0.15, metalness: 0.2 })
// Each lit part glows in its own colour.
GLOW.onBeforeCompile = (shader) => {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <emissivemap_fragment>',
    '#include <emissivemap_fragment>\n totalEmissiveRadiance = vColor.rgb * 0.55;',
  )
}

/** Draws a prop built with a Kit as up to three meshes. `build` should be a stable function; it runs once. */
export function Merged({ build }: { build: (kit: Kit) => void }) {
  const layers = useMemo(() => {
    const kit = new Kit()
    build(kit)
    return kit.build()
  }, [build])
  return (
    <>
      {layers.main && <mesh geometry={layers.main} material={SOLID} castShadow receiveShadow />}
      {layers.trim && <mesh geometry={layers.trim} material={SOLID} receiveShadow />}
      {layers.glow && <mesh geometry={layers.glow} material={GLOW} />}
    </>
  )
}

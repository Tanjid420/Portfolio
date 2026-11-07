import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { useGame } from './store'

// Top-down angle, slightly tilted so buildings and signs read well.
const OFFSET = new Vector3(0, 27, 19)
const lookAt = new Vector3()
const wanted = new Vector3()

export function CameraRig() {
  const camera = useThree((s) => s.camera)

  useFrame((_, delta) => {
    const [x, z] = useGame.getState().focus
    wanted.set(x, 0, z).add(OFFSET)
    // Frame-rate independent smoothing.
    const t = 1 - Math.exp(-4 * delta)
    camera.position.lerp(wanted, t)
    lookAt.set(camera.position.x - OFFSET.x, 0, camera.position.z - OFFSET.z)
    camera.lookAt(lookAt)
  })

  return null
}

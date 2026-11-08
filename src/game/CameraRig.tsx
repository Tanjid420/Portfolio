import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PerspectiveCamera, Vector3 } from 'three'
import { useGame } from './store'

// Top-down angle, slightly tilted so buildings and signs read well.
const OFFSET = new Vector3(0, 27, 19)
const FOV = 45
/** Widest view on tall phone screens, so the sides of the island don't get cut off too much. */
const MAX_FOV = 72
const lookAt = new Vector3()
const wanted = new Vector3()

export function CameraRig() {
  const camera = useThree((s) => s.camera)
  const aspect = useThree((s) => s.size.width / s.size.height)

  // Start right over the hero (who may be mid-game after a trip to the CV page), not at the default spot.
  useEffect(() => {
    const [x, z] = useGame.getState().focus
    camera.position.set(x, 0, z).add(OFFSET)
    camera.lookAt(x, 0, z)
  }, [camera])

  // On portrait screens, open the view up so you can see about as far sideways as on a square screen.
  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return
    const half = (FOV / 2) * (Math.PI / 180)
    const fov = aspect >= 1 ? FOV : (2 * Math.atan(Math.tan(half) / aspect) * 180) / Math.PI
    camera.fov = Math.min(fov, MAX_FOV)
    camera.updateProjectionMatrix()
  }, [camera, aspect])

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

import { useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { CameraRig } from './CameraRig'
import { Island } from './Island'
import { useGame } from './store'
import { ZONES } from './world'

const BG = '#0F1712'

// Until the player arrives in step 3: keys 1–5 or the buttons fly the camera between zones.
function ZonePreview() {
  const setFocus = useGame((s) => s.setFocus)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const zone = ZONES[Number(e.key) - 1]
      if (zone) setFocus(zone.position)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setFocus])

  return (
    <nav className="zone-preview" aria-label="Visit a zone">
      {ZONES.map((z, i) => (
        <button key={z.id} type="button" className="btn btn-ghost" onClick={() => setFocus(z.position)}>
          {i + 1}. {z.name.replace(' Zone', '')}
        </button>
      ))}
    </nav>
  )
}

export default function Game() {
  return (
    <>
      <Canvas
        shadows="percentage"
        dpr={[1, 2]}
        camera={{ position: [0, 20, 35], fov: 45, near: 0.5, far: 300 }}
        data-testid="scene"
      >
        <color attach="background" args={[BG]} />
        <fog attach="fog" args={[BG, 50, 120]} />
        <hemisphereLight args={['#d6ecff', '#1E3D2A', 1.3]} />
        <directionalLight
          position={[25, 40, 18]}
          intensity={2.2}
          color="#fff1d6"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-48}
          shadow-camera-right={48}
          shadow-camera-top={48}
          shadow-camera-bottom={-48}
          shadow-camera-far={120}
          shadow-bias={-0.0005}
        />
        <Island />
        <CameraRig />
      </Canvas>
      <ZonePreview />
    </>
  )
}

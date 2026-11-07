import { Canvas } from '@react-three/fiber'
import { Bugs } from './Bugs'
import { BugReportCard } from './BugReportCard'
import { CameraRig } from './CameraRig'
import { CoverageBar, Minimap } from './Hud'
import { Island } from './Island'
import { Player } from './Player'

const BG = '#0F1712'

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
        <Player />
        <Bugs />
        <CameraRig />
      </Canvas>
      <CoverageBar />
      <Minimap />
      <BugReportCard />
    </>
  )
}

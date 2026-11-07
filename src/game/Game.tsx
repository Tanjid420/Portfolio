import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { BoardPrompt } from './BoardPrompt'
import { Bugs } from './Bugs'
import { BugReportCard } from './BugReportCard'
import { Buildings } from './Buildings'
import { CameraRig } from './CameraRig'
import { isTouch, quality } from './device'
import { HiddenBugs } from './HiddenBugs'
import { CoverageBar, Minimap } from './Hud'
import { Island } from './Island'
import { Player } from './Player'
import { EndScreen, StartScreen, WelcomeBoard } from './Screens'
import { useGameAudio } from './sound'
import { TouchControls } from './TouchControls'

const BG = '#0F1712'
const LOW = quality === 'low'
/** Highest pixel ratio. Phones have very sharp screens, so they draw fewer pixels. */
const MAX_DPR = LOW ? 1.5 : 2

export default function Game() {
  useGameAudio()
  const [dpr, setDpr] = useState(Math.min(window.devicePixelRatio || 1, MAX_DPR))
  return (
    <>
      <Canvas
        shadows="percentage"
        dpr={dpr}
        gl={{ powerPreference: LOW ? 'low-power' : 'high-performance' }}
        camera={{ position: [0, 20, 35], fov: 45, near: 0.5, far: 300 }}
        data-testid="scene"
      >
        {/* If the frame rate stays low, draw fewer pixels. */}
        <PerformanceMonitor onDecline={() => setDpr(1)} />
        <color attach="background" args={[BG]} />
        <fog attach="fog" args={[BG, 50, 120]} />
        <hemisphereLight args={['#d6ecff', '#1E3D2A', 1.3]} />
        <directionalLight
          position={[25, 40, 18]}
          intensity={2.2}
          color="#fff1d6"
          castShadow
          shadow-mapSize={LOW ? [1024, 1024] : [2048, 2048]}
          shadow-camera-left={-48}
          shadow-camera-right={48}
          shadow-camera-top={48}
          shadow-camera-bottom={-48}
          shadow-camera-far={120}
          shadow-bias={-0.0005}
        />
        <Island />
        <Buildings />
        <HiddenBugs />
        <Player />
        <BoardPrompt />
        <Bugs />
        <CameraRig />
      </Canvas>
      <CoverageBar />
      <Minimap />
      {isTouch ? <TouchControls /> : null}
      <BugReportCard />
      <WelcomeBoard />
      <StartScreen />
      <EndScreen />
    </>
  )
}

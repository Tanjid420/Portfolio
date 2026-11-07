import { useEffect, useMemo, useRef } from 'react'
import { BUGS } from './bugs'
import { HIDDEN_BUGS } from './hidden'
import { useGame } from './store'
import { BUILDINGS, coastRadius, MOUNTAINS, ZONES } from './world'

// "Test coverage: 4 / 8 bugs caught · 50%"
export function CoverageBar() {
  const caught = useGame((s) => s.caught.length)
  const hasGlass = useGame((s) => s.hasGlass)
  const found = useGame((s) => s.found.length)
  const total = BUGS.length
  const pct = Math.round((caught / total) * 100)
  return (
    <div className="hud-coverage" data-testid="coverage">
      <div className="hud-coverage-text">
        Test coverage:{' '}
        <strong>
          {caught} / {total}
        </strong>
        <span className="hide-sm"> bugs caught</span> · {pct}%
      </div>
      <div
        className="hud-coverage-bar"
        role="progressbar"
        aria-label="Test coverage"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={caught}
      >
        <div style={{ width: `${pct}%` }} />
      </div>
      {hasGlass ? (
        <div className="hud-hidden" data-testid="hidden-count">
          🔍 Hidden bugs: {found} / {HIDDEN_BUGS.length}
        </div>
      ) : null}
    </div>
  )
}

/** Map extent in world units, centered on the island. */
const VIEW = 44

// Small map of the island: coast, mountains, zones (with bugs left) and the hero.
export function Minimap() {
  const caught = useGame((s) => s.caught)
  const hero = useRef<SVGGElement>(null)

  const coast = useMemo(() => {
    const pts: string[] = []
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * Math.PI * 2
      const r = coastRadius(a)
      pts.push(`${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`)
    }
    return pts.join(' ')
  }, [])

  // Move the hero marker without re-rendering React every frame.
  useEffect(() => {
    const place = (focus: [number, number], facing: number) => {
      const deg = (-facing * 180) / Math.PI
      hero.current?.setAttribute('transform', `translate(${focus[0]} ${focus[1]}) rotate(${deg})`)
    }
    const s = useGame.getState()
    place(s.focus, s.facing)
    return useGame.subscribe((st) => place(st.focus, st.facing))
  }, [])

  return (
    <svg
      className="hud-minimap"
      viewBox={`${-VIEW} ${-VIEW} ${VIEW * 2} ${VIEW * 2}`}
      role="img"
      aria-label="Island map"
      data-testid="minimap"
    >
      <circle r={VIEW} className="map-sea" />
      <polygon points={coast} className="map-land" />
      {MOUNTAINS.map(([x, z, r], i) => (
        <circle key={i} cx={x} cy={z} r={r * 0.8} className="map-mountain" />
      ))}
      {BUILDINGS.map(({ zone, position: [x, z] }) => (
        <rect key={zone} x={x - 2} y={z - 2} width={4} height={4} rx={0.8} className="map-building" />
      ))}
      {ZONES.map((zone) => {
        const bugs = BUGS.filter((b) => b.zone === zone.id)
        const left = bugs.filter((b) => !caught.includes(b.id)).length
        const state = bugs.length === 0 ? 'info' : left === 0 ? 'clear' : 'open'
        const [x, z] = zone.position
        return (
          <g key={zone.id} className={`map-zone map-zone-${state}`}>
            <title>{`${zone.name} (${zone.section})${bugs.length ? `: ${left} bug${left === 1 ? '' : 's'} left` : ''}`}</title>
            <circle cx={x} cy={z} r={zone.radius} />
            {state === 'open' ? (
              <text x={x} y={z} dy="0.35em">
                {left}
              </text>
            ) : state === 'clear' ? (
              <text x={x} y={z} dy="0.35em">
                ✓
              </text>
            ) : null}
          </g>
        )
      })}
      {/* Hero: arrow pointing the way they face. Facing 0 is +z, which is down on the map. */}
      <g ref={hero} className="map-hero">
        <path d="M0 3.2 L2.4 -2 L0 -0.8 L-2.4 -2 Z" />
      </g>
    </svg>
  )
}

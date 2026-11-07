// Shown while the 3D game downloads: a ladybug hovering with its wings buzzing.
// Plain SVG and CSS, so it appears instantly. Screen readers hear "Loading the island".

const SPOTS: [number, number, number][] = [
  [47, 56, 5],
  [43, 74, 4.5],
  [51, 88, 4],
]

export function GameLoading() {
  return (
    <div className="game-loading" role="status">
      <svg className="loader-bug" viewBox="0 0 120 140" width="120" height="140" aria-hidden="true">
        <ellipse className="loader-shadow" cx="60" cy="128" rx="26" ry="5" />
        <g className="loader-body">
          {/* Legs */}
          {[52, 66, 80].map((y, i) => (
            <g key={y} stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" fill="none">
              <path d={`M38 ${y} l-12 ${i - 3}`} />
              <path d={`M82 ${y} l12 ${i - 3}`} />
            </g>
          ))}
          {/* See-through flying wings, buzzing */}
          <ellipse className="loader-wing loader-wing-l" cx="22" cy="74" rx="15" ry="34" />
          <ellipse className="loader-wing loader-wing-r" cx="98" cy="74" rx="15" ry="34" />
          {/* Dark body under the wing cases */}
          <ellipse cx="60" cy="72" rx="20" ry="27" fill="#1A1A1A" />
          {/* Wing cases, spread open from the front, with spots and a shine */}
          {[-1, 1].map((s) => (
            <g key={s} className={s < 0 ? 'loader-case loader-case-l' : 'loader-case loader-case-r'}>
              <path d={s < 0 ? 'M58 44 C34 44 30 100 58 100 Z' : 'M62 44 C86 44 90 100 62 100 Z'} fill="#E8392B" />
              {SPOTS.map(([x, y, r]) => (
                <circle key={y} cx={s < 0 ? x : 120 - x} cy={y} r={r} fill="#1A1A1A" />
              ))}
              <ellipse cx={s < 0 ? 46 : 74} cy="52" rx="3" ry="6" fill="#fff" opacity="0.45" />
            </g>
          ))}
          {/* Head, white patches, eyes and antennae */}
          <ellipse cx="60" cy="42" rx="17" ry="9" fill="#1A1A1A" />
          <ellipse cx="51" cy="42" rx="4" ry="3" fill="#F4F1EA" />
          <ellipse cx="69" cy="42" rx="4" ry="3" fill="#F4F1EA" />
          <circle cx="60" cy="30" r="11" fill="#1A1A1A" />
          <circle cx="55" cy="27" r="4" fill="#fff" />
          <circle cx="65" cy="27" r="4" fill="#fff" />
          <circle cx="55.5" cy="26" r="2" fill="#1A1A1A" />
          <circle cx="65.5" cy="26" r="2" fill="#1A1A1A" />
          <g stroke="#1A1A1A" strokeWidth="2.5" strokeLinecap="round" fill="none">
            <path d="M55 21 Q50 10 44 9" />
            <path d="M65 21 Q70 10 76 9" />
          </g>
          <circle cx="44" cy="9" r="3" fill="#1A1A1A" />
          <circle cx="76" cy="9" r="3" fill="#1A1A1A" />
        </g>
      </svg>
      <span className="visually-hidden">Loading the island</span>
    </div>
  )
}

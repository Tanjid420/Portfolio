import { create } from 'zustand'

const KEY = 'bughunt-muted'

// Storage can throw in private windows or when site data is blocked. Sound stays on then.
function readMuted() {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

interface SoundSettings {
  /** Sound is on by default. The choice is remembered between visits. */
  muted: boolean
  toggleMuted: () => void
}

export const useSoundSettings = create<SoundSettings>((set, get) => ({
  muted: readMuted(),
  toggleMuted: () => {
    const muted = !get().muted
    try {
      localStorage.setItem(KEY, muted ? '1' : '0')
    } catch {
      // Not remembered this time, but the toggle still works.
    }
    set({ muted })
  },
}))

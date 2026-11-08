import { create } from 'zustand'

/** "How to play" panel, opened from the top bar. The game pauses while it's open. */
export const useHelp = create<{ open: boolean; setOpen: (open: boolean) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))

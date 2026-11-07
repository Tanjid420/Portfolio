import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served from tanjid420.github.io/Portfolio/
export default defineConfig({
  base: '/Portfolio/',
  plugins: [react()],
})

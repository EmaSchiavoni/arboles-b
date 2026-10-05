import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Base para GitHub Pages (project site: https://<usuario>.github.io/arboles-b/).
  base: '/arboles-b/',
  plugins: [react()],
})

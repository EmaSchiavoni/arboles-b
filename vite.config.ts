import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Base raíz: el sitio se sirve en el dominio propio (arbolesb.schiavoni.dev).
  base: '/',
  plugins: [react()],
})

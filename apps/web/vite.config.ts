import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // relative asset URLs: the same build runs at a domain root, under a
  // sub-path (GitHub Pages: /<repo>/), and inside the Capacitor WebView
  base: './',
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: { target: 'es2020', sourcemap: false },
})

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// https://vite.dev/config/
// base: './' + singlefile => the production build is one self-contained index.html
// that runs by double-clicking it from the desktop (file://), no server needed.
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  server: {
    host: true,
    port: 43217,
    strictPort: false,
  },
  preview: {
    host: true,
    port: 43217,
  },
})

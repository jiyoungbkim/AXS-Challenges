import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import { cloudflare } from "@cloudflare/vite-plugin";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cloudflare()],
  // hoksiyo-backend's dev server (and its scripts) use 5173.
  server: { port: 5174, strictPort: true },
})

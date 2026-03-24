import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/copilot-token-based-billing-viewer/',
  plugins: [react()],
})

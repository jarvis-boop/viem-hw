import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Required for WebHID
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  // Resolve viem-hw from parent directory
  resolve: {
    alias: {
      'viem-hw': '../src',
    },
  },
  // Handle Node.js polyfills for Trezor
  define: {
    'process.env': {},
    global: 'globalThis',
  },
  optimizeDeps: {
    exclude: ['@trezor/connect'],
  },
})

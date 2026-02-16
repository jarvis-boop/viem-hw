import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Base path for GitHub Pages deployment
  base: '/viem-hw/',
  // Required for WebHID
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  // Resolve viem-hw from parent src directory for local dev
  resolve: {
    alias: {
      'viem-hw': path.resolve(__dirname, '../src'),
      'viem-hw/ledger': path.resolve(__dirname, '../src/ledger'),
      'viem-hw/trezor': path.resolve(__dirname, '../src/trezor'),
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

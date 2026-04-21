import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return
          }

          if (
            id.includes('react-dom') ||
            id.includes('react-router') ||
            id.includes('react/jsx-runtime') ||
            id.includes('/react/')
          ) {
            return 'react-core'
          }

          if (id.includes('@tanstack')) {
            return 'react-query'
          }

          if (id.includes('framer-motion')) {
            return 'motion'
          }

          if (id.includes('lucide-react')) {
            return 'icons'
          }

          if (id.includes('axios')) {
            return 'network'
          }
        },
      },
    },
  },
  server: {
    port: 3001, // Match the port we're using
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})

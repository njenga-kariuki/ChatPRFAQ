import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: true, // Allow external connections
    port: 3000,
    strictPort: true,
    allowedHosts: ['all', '99592daa-41b1-413a-9315-c1c2e2bd4c1f-00-1w69vp7xx1uj4.kirk.replit.dev'], // Allow all hosts for Replit development
    proxy: {
      // Proxy API requests to your Flask backend
      '/api': {
        target: 'http://localhost:5000', // Your Flask app's address
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api') // Ensure '/api' prefix is maintained
      }
    }
  },
  define: {
    global: 'globalThis',
  },
  build: {
    outDir: '../static/react' // Output build to a place Flask can find
  }
}) 
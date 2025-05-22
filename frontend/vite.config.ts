import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000, // You can choose another port if 3000 is taken
    strictPort: true, // Vite will exit if this port is taken
    proxy: {
      // Proxy API requests to your Flask backend
      '/api': {
        target: 'http://localhost:5000', // Your Flask app's address
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api') // Ensure '/api' prefix is maintained
      }
    }
  },
  build: {
    outDir: '../static/react' // Output build to a place Flask can find
  }
}) 
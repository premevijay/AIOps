import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Same-origin proxy to the change service so the dashboard avoids CORS.
      // /api/change/changes -> http://localhost:8089/changes
      '/api/change': {
        target: 'http://localhost:8089',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/change/, ''),
      },
    },
  },
})

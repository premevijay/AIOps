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
      // Same-origin proxy to the supervisor (inventory). /api/agent/devices -> :8088/devices
      '/api/agent': {
        target: 'http://localhost:8088',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/agent/, ''),
      },
      // Same-origin proxy to the results store. /api/results/results/latest -> :8090/results/latest
      '/api/results': {
        target: 'http://localhost:8090',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/results/, ''),
      },
    },
  },
})

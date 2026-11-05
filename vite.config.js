import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // Two pages: the guest invitation (/) and the owner dashboard (/admin/).
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin/index.html'),
      },
    },
  },
  server: {
    host: true,
    // With `npm run dev:api` running, API calls go to the local Worker + D1.
    proxy: { '/api': 'http://localhost:8787' },
  },
});

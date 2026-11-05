import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Forward any /api request from the React app to the Express server.
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});

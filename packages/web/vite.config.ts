import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    strictPort: true,
    host: '127.0.0.1',
    hmr: {
      host: '127.0.0.1',
      port: 3000,
      clientPort: 3000,
      protocol: 'ws',
    },
    proxy: {
      '/nas-api': {
        target: 'http://127.0.0.1:5700',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/nas-api/, ''),
      },
    },
  },
  optimizeDeps: {
    noDiscovery: true,
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'use-sync-external-store/with-selector',
    ],
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});

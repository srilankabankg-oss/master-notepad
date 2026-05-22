import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['vite.svg'],
      manifest: {
        name: 'Master Notepad',
        short_name: 'Notepad',
        description: 'Система управления подрядчиками строительной организации',
        theme_color: '#1a56db',
        background_color: '#f3f4f6',
        display: 'standalone',
        icons: [
          { src: 'vite.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: 'vite.svg', sizes: '512x512', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/localhost:3001\/api\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'api-cache', expiration: { maxEntries: 100, maxAgeSeconds: 300 } },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
  server: {
    port: 3356,
    proxy: {
      '/api': { target: 'http://localhost:3355', changeOrigin: true },
    },
  },
});

import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'frontend/src'),
    },
  },
  test: {
    globals: true,
    testTimeout: 10000,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    environment: 'jsdom',
    environmentOptions: {
      jsdom: { url: 'http://localhost:3356' },
    },
  },
})
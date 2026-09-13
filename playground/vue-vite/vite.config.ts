import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      // Point at the plugin source so edits to `src/` reload without a build.
      'comark-knap': fileURLToPath(new URL('../../src/index.ts', import.meta.url)),
    },
  },
  server: {
    fs: { allow: [fileURLToPath(new URL('../..', import.meta.url))] },
  },
})

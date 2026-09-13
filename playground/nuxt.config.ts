import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  modules: ['@comark/nuxt'],
  ssr: true,
  css: ['~/assets/style.css'],
  alias: {
    // Point at the plugin source so edits to `src/` reload without a build.
    'comark-knap': fileURLToPath(new URL('../src/index.ts', import.meta.url)),
  },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      meta: [{ name: 'color-scheme', content: 'light dark' }],
      link: [{ rel: 'icon', href: 'data:,' }],
    },
  },
  nitro: {
    prerender: {
      routes: ['/'],
      crawlLinks: true,
    },
  },
  vite: {
    server: {
      fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] },
    },
  },
})

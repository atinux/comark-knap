import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  modules: ['@comark/nuxt', '@vercel/analytics'],
  css: ['~/assets/style.css'],
  alias: {
    // Point at the plugin source so edits to `src/` reload without a build.
    'comark-knap': fileURLToPath(new URL('../src/index.ts', import.meta.url)),
  },
  runtimeConfig: {
    public: {
      // Set NUXT_PUBLIC_SITE_URL in production for absolute Open Graph URLs.
      siteUrl: '',
    },
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

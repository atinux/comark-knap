<script setup lang="ts">
const GITHUB_URL = 'https://github.com/atinux/comark-knap'
const DESCRIPTION = 'Knap templates for Comark: variables, filters and if / for logic, rendered to Markdown before Comark parses it.'

useHead({
  titleTemplate: (title) => (title ? `${title} · comark-knap` : 'comark-knap'),
})

// Absolute URL for the Open Graph image: `NUXT_PUBLIC_SITE_URL` in
// production, the request origin otherwise.
const siteUrl = useRuntimeConfig().public.siteUrl || useRequestURL().origin
useSeoMeta({
  description: DESCRIPTION,
  ogType: 'website',
  ogSiteName: 'comark-knap',
  ogTitle: 'comark-knap · Knap templates for Comark',
  ogDescription: DESCRIPTION,
  ogImage: `${siteUrl}/og.png`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: 'comark-knap: a knap template on the left, the Markdown Comark renders from it on the right',
  twitterCard: 'summary_large_image',
  twitterTitle: 'comark-knap · Knap templates for Comark',
  twitterDescription: DESCRIPTION,
  twitterImage: `${siteUrl}/og.png`,
})
</script>

<template>
  <header class="masthead">
    <NuxtLink class="brand" to="/">comark-knap</NuxtLink>
    <nav class="tabs" aria-label="Pages">
      <NuxtLink to="/" exact-active-class="active">Docs</NuxtLink>
      <NuxtLink to="/play" exact-active-class="active">Playground</NuxtLink>
    </nav>
    <nav class="links">
      <a :href="GITHUB_URL">GitHub ↗</a>
      <a href="https://knap.md">knap.md ↗</a>
      <a href="https://comark.dev/plugins/built-in/binding">binding plugin ↗</a>
    </nav>
  </header>

  <NuxtPage />
</template>

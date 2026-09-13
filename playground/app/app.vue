<script setup lang="ts">
const GITHUB_URL = 'https://github.com/atinux/comark-knap'

useHead({
  titleTemplate: (title) => (title ? `${title} · comark-knap` : 'comark-knap'),
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

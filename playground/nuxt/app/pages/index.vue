<script setup lang="ts">
import rangi from '@comark/nuxt/plugins/rangi'
// The docs are the repository README, rendered by Comark itself.
import readme from '../../../../README.md?raw'

useHead({ title: 'Docs' })

const plugins = [rangi()]
</script>

<template>
  <main class="docs">
    <article class="prose">
      <Markdown :value="readme" :plugins="plugins" />
    </article>
  </main>
</template>

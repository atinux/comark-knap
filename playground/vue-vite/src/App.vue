<script setup lang="ts">
import { computed, reactive, ref, shallowRef, watch } from 'vue'
import { parseMarkdown } from 'comark'
import type { MarkdownDocument } from 'comark'
import { renderMarkdown } from 'comark/render'
import { Binding as BindingToMarkdown } from 'comark/plugins/binding'
import { Markdown } from '@comark/vue'
import binding, { Binding } from '@comark/vue/plugins/binding'
import rangi from '@comark/vue/plugins/rangi'
import knap from 'comark-knap'
import type { KnapDiagnostics, TemplateVariables } from 'comark-knap'
import readme from '../../../README.md?raw'

const GITHUB_URL = 'https://github.com/atinux/comark-knap'

// ── Inputs ────────────────────────────────────────────────────────────────

/** Knap template. Everything here is rendered *before* Comark parses it. */
const template = ref(`---
title: "{{ name | title }}"
tags: [reading, reference]
---

# {{ title }}

{% if tags %}Tags: {{ tags | join:", " }}{% endif %}

## Posts ({{ posts | length }})

{% for post in posts %}
- [{{ post.title }}]({{ post.url }}){% if post.draft %} _(draft)_{% endif %}
{% endfor %}

## Stats

{{ stats | table }}

{% set when = published | date:"MMMM D, YYYY" %}
> [!tip]
> Published {{ when }}. Filters like \`callout\` and \`table\` emit Markdown that Comark understands.

---

Hello **{{ data.viewer.name }}**, you are on the *{{ data.viewer.plan }}* plan.
This line is left for Comark's binding plugin: it updates without re-parsing.
`)

/** Variables handed to knap, as editable JSON. */
const variablesJson = ref(
  JSON.stringify(
    {
      name: 'an imported note',
      published: '2026-09-13',
      posts: [
        { title: 'Turn data into Markdown', url: '/knap' },
        { title: 'Components in Markdown', url: '/comark' },
        { title: 'Draft ideas', url: '/draft', draft: true },
      ],
      stats: [
        { metric: 'users', value: 1200 },
        { metric: 'uptime', value: '99.9%' },
      ],
    },
    null,
    2,
  ),
)

/** Runtime data resolved by the binding plugin at render time. */
const data = reactive({ viewer: { name: 'Ada', plan: 'pro' } })

// ── Parsing ───────────────────────────────────────────────────────────────

const jsonError = ref('')
const variables = computed<TemplateVariables>(() => {
  try {
    const parsed = JSON.parse(variablesJson.value)
    jsonError.value = ''
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (error) {
    jsonError.value = (error as Error).message
    return {}
  }
})

const tree = shallowRef<MarkdownDocument>()
const generated = ref('')
const diagnostics = computed<KnapDiagnostics>(
  () => (tree.value?.meta.knap as KnapDiagnostics | undefined) ?? { errors: [], warnings: [] },
)

let timer: ReturnType<typeof setTimeout> | undefined
let run = 0
watch(
  [template, variables],
  () => {
    clearTimeout(timer)
    timer = setTimeout(async () => {
      const current = ++run
      const doc = await parseMarkdown(template.value, {
        // `keepUnresolved` leaves paths with unknown roots (`data.*`) for `binding()`.
        plugins: [knap({ variables: variables.value, keepUnresolved: true }), binding()],
      })
      // The exact markdown Comark parsed, serialized back from the tree.
      const markdown = await renderMarkdown(doc, { components: { Binding: BindingToMarkdown } })
      if (current !== run) return
      tree.value = doc
      generated.value = markdown
    }, 120)
  },
  { immediate: true },
)

// ── View ──────────────────────────────────────────────────────────────────

const page = ref<'playground' | 'docs'>('playground')
const view = ref<'preview' | 'markdown'>('preview')
const components = { Binding }

// The Docs page is the repository README, rendered by Comark itself.
const docsPlugins = [rangi()]
</script>

<template>
  <header class="masthead">
    <a class="brand" :href="GITHUB_URL">comark-knap</a>
    <nav class="tabs" aria-label="Page">
      <button type="button" :aria-pressed="page === 'playground'" @click="page = 'playground'">Playground</button>
      <button type="button" :aria-pressed="page === 'docs'" @click="page = 'docs'">Docs</button>
    </nav>
    <nav class="links">
      <a :href="GITHUB_URL">GitHub ↗</a>
      <a href="https://knap.md">knap.md ↗</a>
      <a href="https://comark.dev/plugins/built-in/binding">binding plugin ↗</a>
    </nav>
  </header>

  <main v-if="page === 'docs'" class="docs">
    <article class="prose">
      <Suspense>
        <Markdown :value="readme" :plugins="docsPlugins" />
        <template #fallback><p>Loading docs…</p></template>
      </Suspense>
    </article>
  </main>

  <main v-else class="workbench">
    <section class="inputs">
      <label class="field">
        <span class="label">Template <small>knap · rendered at parse time</small></span>
        <textarea v-model="template" rows="26" spellcheck="false" />
      </label>

      <label class="field">
        <span class="label">
          Variables <small>JSON · passed to <code>knap({ variables })</code></small>
          <em v-if="jsonError" class="error">{{ jsonError }}</em>
        </span>
        <textarea v-model="variablesJson" rows="14" spellcheck="false" />
      </label>

      <fieldset class="field live">
        <legend class="label">Live data <small>passed to <code>&lt;Markdown :data&gt;</code> · no re-parse</small></legend>
        <label>Viewer <input v-model="data.viewer.name" type="text" /></label>
        <label>
          Plan
          <select v-model="data.viewer.plan">
            <option value="free">free</option>
            <option value="pro">pro</option>
            <option value="team">team</option>
          </select>
        </label>
      </fieldset>
    </section>

    <section class="output">
      <div class="toolbar" role="group" aria-label="Output view">
        <button type="button" :aria-pressed="view === 'preview'" @click="view = 'preview'">Preview</button>
        <button type="button" :aria-pressed="view === 'markdown'" @click="view = 'markdown'">Generated Markdown</button>
        <span class="status" :class="{ error: diagnostics.errors.length }">
          <template v-if="diagnostics.errors.length">{{ diagnostics.errors.length }} error(s)</template>
          <template v-else-if="diagnostics.warnings.length">{{ diagnostics.warnings.length }} warning(s)</template>
          <template v-else>knap ok</template>
        </span>
      </div>

      <div v-if="view === 'preview'" class="document prose">
        <Suspense v-if="tree">
          <Markdown :value="tree" :components="components" :data="data" />
          <template #fallback><p>Rendering…</p></template>
        </Suspense>
      </div>
      <pre v-else class="source"><code>{{ generated }}</code></pre>

      <ul v-if="diagnostics.errors.length || diagnostics.warnings.length" class="diagnostics">
        <li v-for="(e, i) in diagnostics.errors" :key="`e${i}`" class="error">
          {{ e.code }} · line {{ e.line }}:{{ e.column }} · {{ e.message }}
        </li>
        <li v-for="(w, i) in diagnostics.warnings" :key="`w${i}`">
          {{ w.code }} · {{ w.filter }} · line {{ w.line }}:{{ w.column }} · {{ w.message }}
        </li>
      </ul>
    </section>
  </main>
</template>

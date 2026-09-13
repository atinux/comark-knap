import { defineComarkPlugin } from 'comark'
import type { ComarkPluginFactory } from 'comark'
// Handy AST helpers — uncomment when you need them:
// import { visit, textContent } from 'comark/utils'

/**
 * Options accepted by your plugin's factory.
 *
 * TODO: Replace these with whatever your plugin needs — or delete the type
 * (and the `<PluginOptions, …>` argument below) if it takes no options.
 */
export interface PluginOptions {
  /** Set to `false` to disable the plugin. */
  enabled?: boolean
}

/**
 * Keys your plugin contributes to `tree.meta`.
 *
 * Declaring them here makes `tree.meta.*` fully typed for consumers. Use an
 * empty interface (or omit the type parameter) if your plugin doesn't touch
 * `meta`.
 *
 * TODO: Replace `nodeCount` with your plugin's real meta keys.
 */
export interface PluginMeta {
  /** Example meta key written by the starter logic below. */
  nodeCount: number
}

/**
 * TODO: Describe what your plugin does.
 *
 * @example
 * ```ts
 * import { parse } from 'comark'
 * import plugin from 'your-comark-plugin'
 *
 * const tree = await parse(content, { plugins: [plugin()] })
 * ```
 */
const plugin: ComarkPluginFactory<PluginOptions, PluginMeta> = defineComarkPlugin<
  PluginOptions,
  PluginMeta
>((options = {}) => {
  // TODO: Read your options here, with sensible defaults.
  const enabled = options.enabled ?? true

  return {
    // TODO: A unique name for your plugin.
    name: 'your-comark-plugin',

    // ── Optional: extend the markdown-it parser with custom syntax ──────────
    // markdownItPlugins: [],

    // ── Optional: transform the raw markdown string before it is tokenized ──
    // pre(state) {
    //   state.markdown = state.markdown.replace(/foo/g, 'bar')
    // },

    // ── Transform the AST after it is built ─────────────────────────────────
    post(state) {
      if (!enabled) return

      // `state.tree.nodes`       → the AST (array of nodes)
      // `state.tree.frontmatter` → parsed frontmatter
      // `state.tree.meta`        → attach your computed data here
      //
      // TODO: Replace this one-line starter with your plugin's logic.
      // To walk and transform nodes, use `visit` from 'comark/utils', e.g.:
      //
      //   visit(
      //     state.tree,
      //     node => Array.isArray(node) && node[0] === 'img',
      //     node => { node[1].loading = 'lazy' },
      //   )
      state.tree.meta.nodeCount = state.tree.nodes.length
    },
  }
})

export default plugin

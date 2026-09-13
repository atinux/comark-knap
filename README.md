# your-comark-plugin

> This repo is a skeleton — work through the [checklist](#-replace-these) below,
> then replace the starter logic in `src/index.ts` with your own.

A starter for building [Comark](https://comark.dev) plugins in TypeScript:
[tsdown](https://tsdown.dev) builds (ESM + declarations), typed `meta`
contributions, a [Vitest](https://vitest.dev) suite, a `tsx` playground, and
GitHub Actions CI.

## 📋 Replace these

Search the repo for `TODO` and `your-comark-plugin` to find every placeholder.

- [ ] **`package.json`** — `name`, `description`, `keywords`, `author`,
      `homepage`, `bugs`, `repository`.
- [ ] **`LICENSE`** — your name and year (or swap in a different license).
- [ ] **`src/index.ts`** — the plugin `name`, the `PluginOptions` / `PluginMeta`
      types, and the `post` hook logic.
- [ ] **`test/plugin.test.ts`** — real tests for your plugin.
- [ ] **This `README.md`** — the title, description, and usage example.

## Getting started

Use this template on GitHub (or clone it), then:

```bash
pnpm install
pnpm play   # run the playground against your plugin
pnpm test   # run the test suite
pnpm build  # bundle dist/ (ESM + type declarations) with tsdown
```

> Requires Node.js ≥ 22.18 for development (tsdown's requirement); the published
> package itself runs on Node ≥ 20.

## Usage

Consumers register your plugin when parsing:

```ts
import { parse } from 'comark'
import plugin from 'your-comark-plugin'

const tree = await parse(content, { plugins: [plugin()] })
```

## Anatomy of a Comark plugin

A plugin is a factory created with `defineComarkPlugin`. The factory receives
the user's options and returns the plugin object:

```ts
import { defineComarkPlugin } from 'comark'

export default defineComarkPlugin<Options, Meta>((options = {}) => ({
  name: 'your-comark-plugin',

  // Optional markdown-it extensions added to the parser.
  markdownItPlugins: [],

  // Runs on the raw markdown string, before tokenization.
  pre(state) {
    state.markdown = state.markdown.replace(/foo/g, 'bar')
  },

  // Runs after the AST is built — transform nodes and populate metadata.
  post(state) {
    // state.tree.nodes        → the AST
    // state.tree.frontmatter  → parsed frontmatter
    // state.tree.meta         → your place to attach computed data
  },
}))
```

The three type parameters are all optional:

| Parameter     | Describes                                   |
| ------------- | ------------------------------------------- |
| `Options`     | The shape of the factory's argument         |
| `Meta`        | Keys this plugin adds to `tree.meta`        |

Declaring `Meta` is what makes the keys you write come back
fully typed for consumers — see `PluginMeta` in `src/index.ts`.

### The AST

`tree.nodes` is an array of nodes, where a node is one of:

- **Text** — a plain `string`.
- **Element** — a tuple `[tag, attributes, ...children]`.
- **Comment** — a tuple `[null, attributes, content]`.

Traverse and transform it with `visit` from `comark/utils`. The visitor can
return a replacement node, `false` to remove the node, or nothing to leave it
untouched:

```ts
import { visit } from 'comark/utils'

visit(
  state.tree,
  node => Array.isArray(node) && node[0] === 'img',
  (node) => {
    node[1].loading = 'lazy'
  },
)
```

See the [Plugin API](https://comark.dev/plugins/custom/plugin-api) and
[AST API](https://comark.dev/plugins/custom/ast-api) docs for the full reference.

## Scripts

| Script            | Description                                  |
| ----------------- | -------------------------------------------- |
| `pnpm play`       | Run the playground in `playground/index.ts`  |
| `pnpm test`       | Run the test suite once                      |
| `pnpm test:watch` | Run tests in watch mode                      |
| `pnpm typecheck`  | Type-check the whole project (no emit)       |
| `pnpm build`      | Bundle `dist/` (ESM + declarations) via tsdown |
| `pnpm dev`        | Rebuild on change (`tsdown --watch`)         |

## Publishing

`prepack` builds automatically, so a plain publish is enough:

```bash
npm publish
```

## License

[MIT](./LICENSE)

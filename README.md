# comark-knap

A [Comark](https://comark.dev) plugin that renders [knap](https://knap.md)
templates before parsing. Write Markdown with knap variables, filters and
`if` / `for` logic, hand it to Comark with your data, and get a regular Comark
document out.

```md
---
title: "{{ name | title }}"
---

# {{ title }}

{% if tags %}Tags: {{ tags | join:", " }}{% endif %}

{% for post in posts %}
- [{{ post.title }}]({{ post.url }})
{% endfor %}

{{ stats | table }}
```

```ts
import { parseMarkdown } from 'comark'
import knap from 'comark-knap'

const tree = await parseMarkdown(content, {
  plugins: [
    knap({
      variables: {
        name: 'an imported note',
        tags: ['reading', 'reference'],
        posts: [{ title: 'One', url: '/one' }],
        stats: [{ metric: 'users', value: 1200 }],
      },
    }),
  ],
})

tree.frontmatter // { title: 'An Imported Note' }
tree.nodes       // h1, p, ul, table … — plain Comark nodes
tree.meta.knap   // { errors: [], warnings: [] }
```

## Install

```bash
pnpm add comark-knap
```

`comark` is a peer dependency (`>= 0.4`); `knap` is bundled as a dependency.

## How it works

Comark plugins have a `pre` hook that runs on the raw Markdown string before
tokenization. This plugin passes that string through knap's engine and hands
the rendered Markdown back to Comark, so:

- **Every knap feature works**: chained filters, `if` / `elseif` / `else`,
  `for`, `set`, `{# comments #}`, nullish fallbacks, whitespace control, and
  all [standard filters](https://knap.md/filters), including the Markdown
  producing ones (`table`, `list`, `callout`, `yaml_property`, …).
- **The output is ordinary Markdown**, so it flows through Comark's component
  syntax, attributes, code highlighting and every renderer unchanged.
- **Templating happens once, at parse time.** The rendered document is static;
  nothing is re-evaluated when the renderer's data changes.

### Compared to Comark's `binding` plugin

Both use `{{ … }}`, but they answer different questions.

| | `comark-knap` | `comark/plugins/binding` |
| --- | --- | --- |
| When it runs | Parse time (`pre` hook) | Render time, in every renderer |
| Input | Any value you pass as `variables` (plus frontmatter) | `frontmatter`, `data`, `meta`, `props` namespaces |
| Expressions | Full knap: filters, comparisons, `and` / `or`, `??` | A dot-path and an optional `\|\| default` |
| Logic | `{% if %}`, `{% elseif %}`, `{% for %}`, `{% set %}` | `::if{:value="…"}` component (+ `::for` on `main`) |
| Output | Markdown text, then parsed | `binding` / `if` nodes resolved by the renderer |
| Reactive to `data` changes | No | Yes (Vue, React, Svelte, Angular) |
| Round-trips through `renderMarkdown` | No (already rendered) | Yes, via the `Binding` handler |

Use **knap** when the data is known when you parse (build pipelines, importers,
CLI output, "turn this JSON into a note"). Use **binding** when values come
from the running app and must update live.

### Using both

Set `keepUnresolved: true` and register `knap()` before `binding()`. Variables
knap cannot resolve are left in the source as `{{ name }}`, and the binding
plugin turns them into `binding` nodes for the renderer:

```ts
const tree = await parseMarkdown('# {{ title | upper }}\n\nHello {{ data.user.name }}!', {
  plugins: [knap({ variables: { title: 'Docs' }, keepUnresolved: true }), binding()],
})
// ['h1', { id: 'docs' }, 'DOCS'],
// ['p', {}, 'Hello ', ['binding', { ':value': 'data.user.name' }], '!']
```

Two things to keep in mind when mixing them:

- knap parses `||` as boolean *or*, so the binding default syntax
  `{{ path || fallback }}` is evaluated by knap (usually to `false`). Use knap's
  `{{ path ?? "fallback" }}` instead, or keep such paths out of knap's reach.
- Filters still apply to kept variables: `{{ data.x | upper }}` becomes
  `{{ DATA.X }}`.

## Frontmatter

By default (`frontmatter: true`) the plugin:

1. exposes the document's frontmatter keys as top-level template variables
   (explicit `variables` win on conflicts), and
2. runs the template over the frontmatter block itself, then re-reads it so
   `tree.frontmatter` and the body both see the rendered values.

Since Comark 0.7 the built-in `frontmatter` plugin parses the YAML block
*before* user plugins run. Unquoted knap tags are not valid YAML
(`title: {{ x }}` is a YAML flow mapping), so:

- **Quoted values work out of the box**: `title: "{{ name | title }}"`.
- **For knap-style frontmatter** (`{{ year | yaml_property:"year" }}`, block
  output, …), register Comark's own frontmatter plugin *after* `knap()`. Comark
  moves it behind yours, so knap sees the raw block first:

  ```ts
  import frontmatter from 'comark/plugins/frontmatter'

  await parseMarkdown(source, {
    plugins: [knap({ variables }), frontmatter()],
  })
  ```

If the rendered frontmatter is not valid YAML, the original block is kept and a
`RENDER_ERROR` is reported (see below). Pass `frontmatter: false` to leave the
block alone and hide it from the template.

## Errors and warnings

knap reports structured diagnostics (`code`, `message`, `line`, `column`). The
plugin collects them under `tree.meta.knap`:

```ts
tree.meta.knap
// {
//   errors:   [{ code: 'PARSE_ERROR', message: 'Missing closing }}', line: 3, column: 12 }],
//   warnings: [{ code: 'INVALID_FILTER_INPUT', filter: 'date', … }],
// }
```

When a template has errors, its source is left untouched so Comark still parses
the document. That makes the plugin safe in streaming mode, where a
`{% if %}` may not be closed yet. Set `strict: true` to throw a
`TemplateRenderError` instead.

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `variables` | `TemplateVariables \| (ctx) => TemplateVariables` | `{}` | Values for the template. A function receives `{ frontmatter, markdown }` and may be async. |
| `frontmatter` | `boolean` | `true` | Expose frontmatter as variables and template the frontmatter block. |
| `filters` | `FilterRegistry` | `standardFilters` | Filter registry for the engine. Spread `standardFilters` to add your own. |
| `engine` | `TemplateEngine` | — | Bring your own `createEngine()` result; overrides `filters`, `limits`, `allowRegex`. |
| `context` | `TContext` | — | Host context forwarded to custom filters and `resolveVariable`. |
| `resolveVariable` | `VariableResolver` | — | Resolve variables missing from `variables` and frontmatter, lazily and possibly async. |
| `keepUnresolved` | `boolean` | `false` | Leave unresolved variables as `{{ name }}` for a render-time layer such as `binding`. |
| `strict` | `boolean` | `false` | Throw on template errors instead of reporting them in `tree.meta.knap`. |
| `limits` | `RenderLimits` | knap defaults | Forwarded to `createEngine`. |
| `allowRegex` | `boolean` | `true` | Forwarded to `createEngine`; `false` makes `split` / `replace` literal. |
| `enabled` | `boolean` | `true` | Set to `false` to skip the plugin. |

`createEngine`, `standardFilters`, `TemplateRenderError` and the knap types are
re-exported for convenience.

### Custom filters

```ts
import knap, { standardFilters } from 'comark-knap'
import type { TemplateFilter } from 'comark-knap'

const shout: TemplateFilter = (value) => `${value}!`

knap({ filters: { ...standardFilters, shout } })
```

DOM-dependent filters (`html_to_json`, `remove_html`) live in `knap/html` and
can be spread in the same way where a DOM is available.

## Caveats

- knap is a text template engine and does not know Markdown: `{{ … }}` inside
  fenced code blocks is rendered too. Escape it with knap's `{# #}` comments
  or a `{% set %}` literal when you need the raw syntax in output.
- Unrendered knap tags left in the document (after an error) meet Comark's
  attribute syntax: `text{% if x %}` is parsed as an attribute block. Check
  `tree.meta.knap.errors` when output looks off.
- Rendering is limited by knap's defaults (template size, output size, work
  operations). Tune them with `limits`.

## Development

```bash
pnpm install
pnpm play   # run playground/index.ts
pnpm test   # vitest
pnpm build  # tsdown → dist/
```

## License

[MIT](./LICENSE)

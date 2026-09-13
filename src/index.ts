import { defineComarkPlugin, parseFrontmatter } from 'comark'
import type { ComarkParsePreState, ComarkPluginFactory } from 'comark'
import { createEngine, standardFilters, TemplateRenderError } from 'knap'
import type {
  FilterRegistry,
  RenderLimits,
  TemplateEngine,
  TemplateError,
  TemplateVariables,
  TemplateWarning,
  VariableResolver,
} from 'knap'

/** Context handed to a `variables` function. */
export interface KnapVariablesContext {
  /** The document's frontmatter as parsed *before* templating (`{}` when absent). */
  frontmatter: Record<string, unknown>
  /** The raw markdown handed to the plugin (frontmatter included when still present). */
  markdown: string
}

/**
 * Options accepted by the knap plugin factory.
 *
 * @typeParam TContext - Shape of the host `context` forwarded to knap filters
 * and variable resolvers.
 */
export interface KnapPluginOptions<TContext = unknown> {
  /** Set to `false` to disable the plugin. */
  enabled?: boolean
  /**
   * Variables available to the template, or a function computing them per
   * document. Explicit variables take precedence over frontmatter keys.
   */
  variables?:
    | TemplateVariables
    | ((ctx: KnapVariablesContext) => TemplateVariables | Promise<TemplateVariables>)
  /** Host context forwarded to custom filters and `resolveVariable`. */
  context?: TContext
  /** Resolve variables missing from `variables` (and frontmatter) lazily. */
  resolveVariable?: VariableResolver<TContext>
  /**
   * Filter registry used to build the engine.
   * @default standardFilters
   */
  filters?: FilterRegistry<TContext>
  /** Rendering limits forwarded to `createEngine`. */
  limits?: RenderLimits
  /** Forwarded to `createEngine`; `false` makes `split` / `replace` literal. */
  allowRegex?: boolean
  /**
   * Bring your own engine. When set, `filters`, `limits` and `allowRegex`
   * are ignored.
   */
  engine?: TemplateEngine<TContext>
  /**
   * Expose the document's frontmatter keys as top-level template variables
   * and run the template over the frontmatter block itself.
   * @default true
   */
  frontmatter?: boolean
  /**
   * Leave variables that resolve to `undefined` in the source as
   * `{{ name }}` instead of rendering them empty, so a render-time layer
   * (Comark's `binding` plugin) can pick them up later.
   * @default false
   */
  keepUnresolved?: boolean
  /**
   * Throw a `TemplateRenderError` on template errors instead of leaving the
   * offending block untouched and reporting under `tree.meta.knap`.
   * @default false
   */
  strict?: boolean
}

/** Diagnostics collected while templating one document. */
export interface KnapDiagnostics {
  errors: TemplateError[]
  warnings: TemplateWarning[]
}

/** Keys this plugin contributes to `tree.meta`. */
export interface KnapPluginMeta {
  /** Template errors and warnings for the parsed document. */
  knap: KnapDiagnostics
}

const STATE_KEY = '__comarkKnap'
const FRONTMATTER_DELIMITER = '---'
/** Cheap pre-check: a template without any knap delimiter is a no-op. */
const HAS_KNAP_SYNTAX = /\{[{%#]/

interface FrontmatterSplit {
  /** The opening delimiter line, e.g. `---\n`. */
  prefix: string
  /** The YAML text between the delimiters. */
  frontmatter: string
  /** The closing delimiter and its line ending. */
  suffix: string
  /** Everything after the frontmatter block. */
  content: string
}

/**
 * Split a leading frontmatter block without parsing it, mirroring the
 * delimiter rules of Comark's `parseFrontmatter` so the block can be
 * re-assembled byte for byte.
 */
function splitFrontmatter(markdown: string): FrontmatterSplit | undefined {
  if (!markdown.startsWith(FRONTMATTER_DELIMITER)) return undefined
  const idx = markdown.indexOf(`\n${FRONTMATTER_DELIMITER}`)
  if (idx === -1) return undefined
  const cr = markdown[idx - 1] === '\r' ? 1 : 0
  const frontmatter = markdown.slice(4, idx - cr)
  if (!frontmatter) return undefined
  return {
    prefix: markdown.slice(0, 4),
    frontmatter,
    suffix: markdown.slice(idx - cr, idx + 4 + cr),
    content: markdown.slice(idx + 4 + cr),
  }
}

/** Parse a bare YAML frontmatter body, returning `undefined` when invalid. */
function parseYamlText(text: string): Record<string, unknown> | undefined {
  try {
    const { data } = parseFrontmatter(`${FRONTMATTER_DELIMITER}\n${text}\n${FRONTMATTER_DELIMITER}\n`)
    return typeof data === 'object' && data !== null ? data : {}
  } catch {
    return undefined
  }
}

/**
 * Render [knap](https://knap.md) templates in Comark documents.
 *
 * Runs in the `pre` hook, before tokenization: the whole markdown source is
 * handed to the knap engine and the produced markdown is what Comark parses.
 * Frontmatter is exposed to the template as top-level variables and is itself
 * templated. Errors are reported under `tree.meta.knap`.
 *
 * @example
 * ```ts
 * import { parseMarkdown } from 'comark'
 * import knap from 'comark-knap'
 *
 * const tree = await parseMarkdown(
 *   '# {{ title | upper }}\n\n{% for tag in tags %}- {{ tag }}\n{% endfor %}',
 *   { plugins: [knap({ variables: { title: 'Hello', tags: ['a', 'b'] } })] },
 * )
 * ```
 */
const plugin: ComarkPluginFactory<KnapPluginOptions<any>, KnapPluginMeta> = defineComarkPlugin<
  KnapPluginOptions<any>,
  KnapPluginMeta
>((options = {}) => {
  const {
    enabled = true,
    variables,
    context,
    resolveVariable,
    frontmatter: useFrontmatter = true,
    keepUnresolved = false,
    strict = false,
  } = options

  const engine: TemplateEngine<any> =
    options.engine ??
    createEngine({
      filters: options.filters ?? standardFilters,
      limits: options.limits,
      allowRegex: options.allowRegex,
    })

  const resolver: VariableResolver<any> | undefined =
    resolveVariable || keepUnresolved
      ? async (name, ctx) => {
          const value = await resolveVariable?.(name, ctx)
          if (value !== undefined) return value
          return keepUnresolved ? `{{ ${name} }}` : undefined
        }
      : undefined

  /**
   * Render one template. Returns `undefined` (and records the errors) when
   * the template cannot be rendered, so callers keep the original text.
   */
  async function render(
    template: string,
    vars: TemplateVariables,
    diagnostics: KnapDiagnostics,
  ): Promise<string | undefined> {
    if (!HAS_KNAP_SYNTAX.test(template)) return template
    const result = await engine.render(template, { variables: vars, context, resolveVariable: resolver })
    diagnostics.warnings.push(...result.warnings)
    if (result.errors.length > 0) {
      if (strict) throw new TemplateRenderError(result.errors)
      diagnostics.errors.push(...result.errors)
      return undefined
    }
    return result.output
  }

  return {
    name: 'knap',

    async pre(state: ComarkParsePreState) {
      if (!enabled) return
      const diagnostics: KnapDiagnostics = { errors: [], warnings: [] }
      state[STATE_KEY] = diagnostics

      // 1. Locate the frontmatter. Comark ≥ 0.7 extracts it in a built-in
      //    plugin that runs before us (`state.frontmatterText`); otherwise it
      //    is still part of `state.markdown` and we split it ourselves.
      const extracted = typeof state.frontmatterText === 'string' && state.frontmatterText.length > 0
      const split = !extracted && useFrontmatter ? splitFrontmatter(state.markdown) : undefined
      let frontmatterText = extracted ? (state.frontmatterText as string) : (split?.frontmatter ?? '')
      let body = extracted ? state.markdown : (split?.content ?? state.markdown)

      // 2. Collect variables.
      const rawFrontmatter: Record<string, unknown> = extracted
        ? ((state.frontmatter as Record<string, unknown> | undefined) ?? {})
        : (parseYamlText(frontmatterText) ?? {})
      const userVariables =
        typeof variables === 'function'
          ? await variables({ frontmatter: rawFrontmatter, markdown: state.markdown })
          : (variables ?? {})

      // 3. Template the frontmatter block itself, then re-read it so the body
      //    sees the rendered values (`{{ title | upper }}` in frontmatter is
      //    valid YAML only when quoted — see README).
      let frontmatterData = rawFrontmatter
      if (useFrontmatter && frontmatterText) {
        const rendered = await render(frontmatterText, { ...rawFrontmatter, ...userVariables }, diagnostics)
        if (rendered !== undefined && rendered !== frontmatterText) {
          const parsed = parseYamlText(rendered)
          if (parsed === undefined) {
            const error: TemplateError = {
              code: 'RENDER_ERROR',
              message: 'Frontmatter is not valid YAML after templating',
              line: 1,
              column: 1,
            }
            if (strict) throw new TemplateRenderError([error])
            diagnostics.errors.push(error)
          } else {
            frontmatterText = rendered
            frontmatterData = parsed
            if (extracted) {
              state.frontmatterText = rendered
              state.frontmatter = parsed
            }
          }
        }
      }

      // 4. Template the body.
      const bodyVariables: TemplateVariables = useFrontmatter
        ? { ...frontmatterData, ...userVariables }
        : userVariables
      const renderedBody = await render(body, bodyVariables, diagnostics)
      if (renderedBody !== undefined) body = renderedBody

      // 5. Write back, re-assembling the frontmatter block when we split it.
      state.markdown = split ? `${split.prefix}${frontmatterText}${split.suffix}${body}` : body
    },

    post(state) {
      const diagnostics = state[STATE_KEY] as KnapDiagnostics | undefined
      if (!diagnostics) return
      state.tree.meta.knap = diagnostics
    },
  }
})

export default plugin
export { createEngine, standardFilters, TemplateRenderError } from 'knap'
export type {
  FilterRegistry,
  RenderLimits,
  TemplateEngine,
  TemplateError,
  TemplateFilter,
  TemplateVariables,
  TemplateWarning,
  VariableResolver,
} from 'knap'

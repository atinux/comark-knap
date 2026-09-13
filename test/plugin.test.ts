import { parseMarkdown } from 'comark'
import binding from 'comark/plugins/binding'
import frontmatter from 'comark/plugins/frontmatter'
import { describe, expect, it } from 'vitest'
import knap, { TemplateRenderError } from '../src/index.ts'
import type { TemplateFilter } from '../src/index.ts'

describe('comark-knap', () => {
  it('interpolates variables and applies filters', async () => {
    const tree = await parseMarkdown('# {{ title | upper }}\n\nTags: {{ tags | join:", " }}', {
      plugins: [knap({ variables: { title: 'Hello', tags: ['a', 'b'] } })],
    })

    expect(tree.nodes).toEqual([
      ['h1', { id: 'hello' }, 'HELLO'],
      ['p', {}, 'Tags: a, b'],
    ])
    expect(tree.meta.knap).toEqual({ errors: [], warnings: [] })
  })

  it('renders if / elseif / else and for blocks into markdown structure', async () => {
    const source = [
      '{% if posts %}',
      '## Posts',
      '',
      '{% for post in posts %}',
      '- [{{ post.title }}]({{ post.url }})',
      '{% endfor %}',
      '{% else %}',
      'No posts yet.',
      '{% endif %}',
    ].join('\n')

    const posts = [
      { title: 'One', url: '/one' },
      { title: 'Two', url: '/two' },
    ]
    const withPosts = await parseMarkdown(source, { plugins: [knap({ variables: { posts } })] })
    expect(withPosts.nodes).toEqual([
      ['h2', { id: 'posts' }, 'Posts'],
      [
        'ul',
        {},
        ['li', {}, ['a', { href: '/one' }, 'One']],
        ['li', {}, ['a', { href: '/two' }, 'Two']],
      ],
    ])

    const empty = await parseMarkdown(source, { plugins: [knap({ variables: { posts: [] } })] })
    expect(empty.nodes).toEqual([['p', {}, 'No posts yet.']])
  })

  it('uses knap markdown filters to produce structure', async () => {
    const tree = await parseMarkdown('{{ rows | table }}', {
      plugins: [
        knap({
          variables: {
            rows: [
              { name: 'Ada', role: 'admin' },
              { name: 'Bob', role: 'guest' },
            ],
          },
        }),
      ],
    })

    expect(tree.nodes[0]?.[0]).toBe('table')
    expect(JSON.stringify(tree.nodes)).toContain('Ada')
  })

  describe('frontmatter', () => {
    it('exposes frontmatter keys as top-level variables', async () => {
      const tree = await parseMarkdown('---\ntitle: Hello\ntags: [a, b]\n---\n\n# {{ title }} ({{ tags | length }})', {
        plugins: [knap()],
      })

      expect(tree.frontmatter).toEqual({ title: 'Hello', tags: ['a', 'b'] })
      expect(tree.nodes).toEqual([['h1', { id: 'hello-2' }, 'Hello (2)']])
    })

    it('gives explicit variables precedence over frontmatter', async () => {
      const tree = await parseMarkdown('---\ntitle: From frontmatter\n---\n{{ title }}', {
        plugins: [knap({ variables: { title: 'From options' } })],
      })

      expect(tree.nodes).toEqual([['p', {}, 'From options']])
    })

    it('templates quoted values inside the frontmatter block', async () => {
      const tree = await parseMarkdown('---\ntitle: "{{ name | upper }}"\nn: 1\n---\n{{ title }}', {
        plugins: [knap({ variables: { name: 'ada' } })],
      })

      expect(tree.frontmatter).toEqual({ title: 'ADA', n: 1 })
      expect(tree.nodes).toEqual([['p', {}, 'ADA']])
    })

    it('templates unquoted frontmatter when ordered before the frontmatter plugin', async () => {
      const source = [
        '---',
        '{{ year | yaml_property:"year" }}',
        '{{ genres | yaml_property:"genre" }}',
        '---',
        '',
        '# {{ genres | first }}',
      ].join('\n')

      const tree = await parseMarkdown(source, {
        plugins: [knap({ variables: { year: 1999, genres: ['sci-fi', 'drama'] } }), frontmatter()],
      })

      expect(tree.frontmatter).toEqual({ year: 1999, genre: ['sci-fi', 'drama'] })
      expect(tree.nodes).toEqual([['h1', { id: 'sci-fi' }, 'sci-fi']])
    })

    it('works without the built-in frontmatter plugin', async () => {
      const tree = await parseMarkdown('---\ntitle: Hi\n---\n\n{{ title }}', {
        registerDefaultPlugins: false,
        plugins: [knap()],
      })

      // The `---` block stays in the document (no frontmatter plugin), but the
      // template still saw its keys and the block round-trips untouched.
      expect(tree.frontmatter).toEqual({})
      expect(tree.nodes).toEqual([
        ['hr', {}],
        ['h2', { id: 'title-hi' }, 'title: Hi'],
        ['p', {}, 'Hi'],
      ])
    })

    it('can be told to ignore frontmatter', async () => {
      const tree = await parseMarkdown('---\ntitle: Hello\n---\n{{ title }}', {
        plugins: [knap({ frontmatter: false })],
      })

      expect(tree.frontmatter).toEqual({ title: 'Hello' })
      // `title` is unknown to the template, so it renders empty.
      expect(tree.nodes).toEqual([])
    })

    it('reports frontmatter that stops being valid YAML after templating', async () => {
      const tree = await parseMarkdown('---\ntitle: "{{ raw }}"\n---\n{{ title }}', {
        plugins: [knap({ variables: { raw: '" : [' } })],
      })

      expect(tree.meta.knap.errors).toEqual([
        expect.objectContaining({ code: 'RENDER_ERROR', message: expect.stringContaining('not valid YAML') }),
      ])
      // The original frontmatter is kept.
      expect(tree.frontmatter).toEqual({ title: '{{ raw }}' })
    })
  })

  describe('variables', () => {
    it('accepts a function receiving the frontmatter', async () => {
      const tree = await parseMarkdown('---\nslug: hello\n---\n{{ path }}', {
        plugins: [
          knap({
            variables: ({ frontmatter }) => ({ path: `/posts/${frontmatter.slug}` }),
          }),
        ],
      })

      expect(tree.nodes).toEqual([['p', {}, '/posts/hello']])
    })

    it('resolves missing variables through resolveVariable with context', async () => {
      const tree = await parseMarkdown('{{ remote | upper }}', {
        plugins: [
          knap({
            context: { id: '42' },
            resolveVariable: async (name, { context }) => (name === 'remote' ? `value-${context.id}` : undefined),
          }),
        ],
      })

      expect(tree.nodes).toEqual([['p', {}, 'VALUE-42']])
    })
  })

  describe('filters', () => {
    it('accepts custom filters alongside the standard ones', async () => {
      const shout: TemplateFilter = (value) => `${value}!`
      const { standardFilters } = await import('knap')
      const tree = await parseMarkdown('{{ title | upper | shout }}', {
        plugins: [knap({ filters: { ...standardFilters, shout }, variables: { title: 'hi' } })],
      })

      expect(tree.nodes).toEqual([['p', {}, 'HI!']])
    })

    it('accepts a pre-built engine', async () => {
      const { createEngine, standardFilters } = await import('knap')
      const engine = createEngine({ filters: standardFilters })
      const tree = await parseMarkdown('{{ title | trim }}', {
        plugins: [knap({ engine, variables: { title: '  hi  ' } })],
      })

      expect(tree.nodes).toEqual([['p', {}, 'hi']])
    })
  })

  describe('errors', () => {
    it('leaves the source untouched and reports errors in meta by default', async () => {
      const tree = await parseMarkdown('# Title\n\n{{ unclosed', { plugins: [knap()] })

      expect(tree.nodes).toEqual([
        ['h1', { id: 'title' }, 'Title'],
        ['p', {}, '{{ unclosed'],
      ])
      expect(tree.meta.knap.errors).toEqual([expect.objectContaining({ code: 'PARSE_ERROR' })])
    })

    it('throws in strict mode', async () => {
      await expect(parseMarkdown('{{ unclosed', { plugins: [knap({ strict: true })] })).rejects.toBeInstanceOf(
        TemplateRenderError,
      )
    })

    it('reports unknown filters', async () => {
      const tree = await parseMarkdown('{{ title | nope }}', { plugins: [knap({ variables: { title: 'x' } })] })

      expect(tree.meta.knap.errors).toEqual([expect.objectContaining({ code: 'UNKNOWN_FILTER' })])
    })

    it('collects non-fatal warnings', async () => {
      const tree = await parseMarkdown('{{ when | date:"YYYY" }}', {
        plugins: [knap({ variables: { when: 'not a date' } })],
      })

      expect(tree.meta.knap.errors).toEqual([])
      expect(tree.meta.knap.warnings.length).toBeGreaterThan(0)
    })

    it('does not render partial templates while streaming', async () => {
      const tree = await parseMarkdown('Hello {% if user %}{{ user }}', { plugins: [knap({ variables: { user: 'Ada' } })] })

      expect(tree.meta.knap.errors.length).toBeGreaterThan(0)
      // The source is left for Comark as-is: `{{ user }}` is not rendered to
      // "Ada" (Comark's own attribute syntax then swallows the `{% … %}`).
      expect(tree.nodes).toEqual([['p', {}, 'Hello {{ user }}']])
    })
  })

  describe('interop with the binding plugin', () => {
    it('keepUnresolved leaves unknown variables for render-time binding', async () => {
      const tree = await parseMarkdown('# {{ title | upper }}\n\nHello {{ data.user.name }}!', {
        plugins: [knap({ variables: { title: 'Docs' }, keepUnresolved: true }), binding()],
      })

      expect(tree.nodes).toEqual([
        ['h1', { id: 'docs' }, 'DOCS'],
        ['p', {}, 'Hello ', ['binding', { ':value': 'data.user.name' }], '!'],
      ])
    })

    it('keepUnresolved does not turn missing properties of known names into placeholders', async () => {
      const source = [
        '{% set n = posts | length %}',
        '{% for post in posts %}',
        '- {{ post.title }}{% if post.draft %} (draft){% endif %}',
        '{% endfor %}',
        '',
        '{{ n }} posts, {{ missing.count }} for {{ data.user }}',
      ].join('\n')
      const tree = await parseMarkdown(source, {
        plugins: [
          knap({
            variables: { posts: [{ title: 'One' }, { title: 'Two', draft: true }] },
            keepUnresolved: true,
          }),
          binding(),
        ],
      })

      expect(tree.meta.knap.errors).toEqual([])
      expect(tree.nodes).toEqual([
        ['ul', {}, ['li', {}, 'One'], ['li', {}, 'Two(draft)']],
        [
          'p',
          {},
          '2 posts, ',
          ['binding', { ':value': 'missing.count' }],
          ' for ',
          ['binding', { ':value': 'data.user' }],
        ],
      ])
    })

    it('keepUnresolved accepts an explicit list of roots', async () => {
      const tree = await parseMarkdown('{{ data.user }} / {{ props.title }} / {{ missing }}', {
        plugins: [knap({ keepUnresolved: ['data', 'props'] }), binding()],
      })

      expect(tree.nodes).toEqual([
        ['p', {}, ['binding', { ':value': 'data.user' }], ' / ', ['binding', { ':value': 'props.title' }], ' /'],
      ])
    })

    it('consumes every {{ }} when keepUnresolved is off', async () => {
      const tree = await parseMarkdown('Hello {{ data.user.name }}!', {
        plugins: [knap(), binding()],
      })

      expect(tree.nodes).toEqual([['p', {}, 'Hello !']])
    })
  })

  it('skips documents without knap syntax', async () => {
    const tree = await parseMarkdown('# Plain\n\n::alert{type="info"}\nHi\n::', { plugins: [knap()] })

    expect(tree.nodes).toEqual([
      ['h1', { id: 'plain' }, 'Plain'],
      ['alert', { type: 'info' }, 'Hi'],
    ])
    expect(tree.meta.knap).toEqual({ errors: [], warnings: [] })
  })

  it('can be disabled', async () => {
    const tree = await parseMarkdown('{{ title }}', { plugins: [knap({ enabled: false, variables: { title: 'x' } })] })

    expect(tree.nodes).toEqual([['p', {}, '{{ title }}']])
    expect(tree.meta.knap).toBeUndefined()
  })
})

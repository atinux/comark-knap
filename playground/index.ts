import { parseMarkdown } from 'comark'
import { renderMarkdown } from 'comark/render'
import knap from '../src/index.ts'

// A scratchpad for trying the plugin. Edit the template or the variables,
// then run `pnpm play` to see the parsed tree and the rendered markdown.
const content = `---
title: "{{ name | title }}"
tags: [reading, reference]
---

# {{ title }}

{% if tags %}Tags: {{ tags | join:", " }}{% endif %}

{% for post in posts %}
- [{{ post.title }}]({{ post.url }}){% if post.draft %} _(draft)_{% endif %}
{% endfor %}

{{ stats | table }}
`

const tree = await parseMarkdown(content, {
  plugins: [
    knap({
      variables: {
        name: 'an imported note',
        posts: [
          { title: 'One', url: '/one' },
          { title: 'Two', url: '/two', draft: true },
        ],
        stats: [
          { metric: 'users', value: 1200 },
          { metric: 'uptime', value: '99.9%' },
        ],
      },
    }),
  ],
})

console.log('frontmatter:', tree.frontmatter)
console.log('meta:', tree.meta)
console.log('nodes:', JSON.stringify(tree.nodes, null, 2))
console.log('markdown:\n' + (await renderMarkdown(tree)))

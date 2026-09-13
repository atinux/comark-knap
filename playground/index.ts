import { parse } from 'comark'
import plugin from '../src/index.ts'

// A scratchpad for trying your plugin. Edit the content, tweak `src/index.ts`,
// then run `pnpm play` to see the result.
const content = `---
title: Playground
---

# Hello

Some **markdown** to run your plugin against.
`

const tree = await parse(content, { plugins: [plugin()] })

console.log('nodes:', tree.nodes)
console.log('frontmatter:', tree.frontmatter)
console.log('meta:', tree.meta)

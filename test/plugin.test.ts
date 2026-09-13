import { parse } from 'comark'
import { describe, expect, it } from 'vitest'
import plugin from '../src/index.ts'

// TODO: Replace these smoke tests with real tests for your plugin.
describe('your-comark-plugin', () => {
  it('registers and parses without error', async () => {
    const tree = await parse('# Hello world', { plugins: [plugin()] })

    expect(tree.meta.nodeCount).toBe(tree.nodes.length)
  })

  it('can be disabled', async () => {
    const tree = await parse('# Hello world', {
      plugins: [plugin({ enabled: false })],
    })

    expect(tree.meta.nodeCount).toBeUndefined()
  })
})

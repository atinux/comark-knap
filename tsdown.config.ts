import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  // ESM only — Comark is a pure-ESM package, so a CJS build would fail at
  // runtime. Add 'cjs' here only if you really need it.
  format: ['esm'],
  // Emit type declarations alongside the JS.
  dts: true,
  // `comark` (and any other dependency / peerDependency) is externalized
  // automatically; only your own code is bundled.
})

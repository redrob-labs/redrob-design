import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: './src/index.ts',
    'library/index': './src/library/index.ts'
  },
  platform: 'node',
  format: ['esm'],
  sourcemap: true,
  clean: true,
  outDir: './dist',
  treeshake: false,
  deps: {
    alwaysBundle: ['@redrob-design/mcp', /^@redrob-design\/mcp\//],
    neverBundle: ['@redrob-design/core', /^@redrob-design\/core\//, 'canvaskit-wasm', /^node:/],
    onlyBundle: false
  }
})

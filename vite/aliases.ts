import { resolve } from 'node:path'

export function createRedrobAliases(rootDir: string) {
  const emptyNodeModule = resolve(rootDir, 'vite/empty-node-module.ts')

  return [
    { find: /^fs$/, replacement: emptyNodeModule },
    { find: /^path$/, replacement: emptyNodeModule },
    { find: '@', replacement: resolve(rootDir, 'src') },
    { find: '#vue', replacement: resolve(rootDir, 'packages/vue/src') },
    { find: '#core', replacement: resolve(rootDir, 'packages/core/src') },
    { find: '#dom-css', replacement: resolve(rootDir, 'packages/dom-css/src') },
    {
      find: /^@redrob-design\/dom-css\/browser$/,
      replacement: resolve(rootDir, 'packages/dom-css/src/browser.ts')
    },
    {
      find: /^@redrob-design\/dom-css\/jsx-runtime$/,
      replacement: resolve(rootDir, 'packages/dom-css/src/jsx/runtime.ts')
    },
    {
      find: /^@redrob-design\/dom-css\/jsx-dev-runtime$/,
      replacement: resolve(rootDir, 'packages/dom-css/src/jsx/dev-runtime.ts')
    },
    {
      find: /^@redrob-design\/dom-css$/,
      replacement: resolve(rootDir, 'packages/dom-css/src/index.ts')
    },
    {
      find: /^@redrob-design\/scene-graph$/,
      replacement: resolve(rootDir, 'packages/scene-graph/src/index.ts')
    },
    { find: '@redrob-design/scene-graph', replacement: resolve(rootDir, 'packages/scene-graph/src') },
    { find: /^@redrob-design\/pen$/, replacement: resolve(rootDir, 'packages/pen/src/index.ts') },
    { find: '@redrob-design/pen', replacement: resolve(rootDir, 'packages/pen/src') },
    { find: /^@redrob-design\/kiwi$/, replacement: resolve(rootDir, 'packages/kiwi/src/index.ts') },
    { find: '@redrob-design/kiwi', replacement: resolve(rootDir, 'packages/kiwi/src') },
    { find: /^@redrob-design\/fig$/, replacement: resolve(rootDir, 'packages/fig/src/index.ts') },
    { find: '@redrob-design/fig', replacement: resolve(rootDir, 'packages/fig/src') },
    {
      find: /^@redrob-design\/mcp\/discovery$/,
      replacement: resolve(rootDir, 'packages/mcp/src/transport/discovery.ts')
    },
    {
      find: /^@redrob-design\/mcp\/transport$/,
      replacement: resolve(rootDir, 'packages/mcp/src/transport/paths.ts')
    },
    { find: /^@redrob-design\/vue$/, replacement: resolve(rootDir, 'packages/vue/src/index.ts') },
    { find: '@redrob-design/vue', replacement: resolve(rootDir, 'packages/vue/src') },
    { find: /^@redrob-design\/core$/, replacement: resolve(rootDir, 'packages/core/src/index.ts') },
    { find: '@redrob-design/core', replacement: resolve(rootDir, 'packages/core/src') },
    {
      find: 'opentype.js',
      replacement: resolve(rootDir, 'node_modules/opentype.js/dist/opentype.mjs')
    }
  ]
}

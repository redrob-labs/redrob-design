import fsd from '@feature-sliced/steiger-plugin'
import { defineConfig } from 'steiger'

import { redrobDesignArchitecturePlugin } from './tools/architecture/src/steiger-rules/index.ts'

// RedrobDesign is not laid out as canonical Feature-Sliced Design layers.
// Keep Steiger focused on project-specific architecture boundaries instead of
// enabling fsd.configs.recommended, which treats src/ and packages/ as FSD layer typos.
export default defineConfig([
  fsd.plugin,
  redrobDesignArchitecturePlugin,
  {
    ignores: [
      '.claude/**',
      'node_modules/**',
      'dist/**',
      'desktop/**',
      'public/**',
      'scratch/**',
      'demo-recordings/**'
    ]
  },
  {
    rules: {
      'redrob-design/prefer-domain-folders-over-filename-prefixes': 'error',
      'redrob-design/strict-test-file-placement': 'error',
      'redrob-design/no-engine-only-assertions-in-e2e': 'error',
      'redrob-design/no-e2e-imports-in-engine-tests': 'error',
      'redrob-design/no-root-markdown-clutter': 'error',
      'redrob-design/no-prototype-or-generated-imports': 'error',
      'redrob-design/no-property-panel-imports-in-canvas': 'error',
      'redrob-design/no-app-imports-in-workspace-packages': 'error',
      'redrob-design/no-package-internals-in-app': 'error',
      'redrob-design/no-foreign-package-local-aliases': 'error',
      'redrob-design/no-app-imports-components-or-views': 'error',
      'redrob-design/no-components-import-views': 'error',
      'redrob-design/no-views-imported-outside-entry': 'error',
      'redrob-design/no-non-ui-imports-in-shared-ui': 'error',
      'redrob-design/no-app-imports-in-shared-ui': 'error',
      'redrob-design/no-property-panel-internals-outside-panel': 'error',
      'redrob-design/no-native-title-attributes-in-vue': 'error',
      'redrob-design/no-ui-imports-in-core': 'error',
      'redrob-design/scripts-are-entrypoint-shims': 'error',
      'redrob-design/strict-tools-layout': 'error'
    }
  }
])

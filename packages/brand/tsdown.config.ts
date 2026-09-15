import { readFileSync } from 'node:fs'

import { defineConfig } from 'tsdown'

const packageJSON = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  dependencies?: Record<string, string>
}

export default defineConfig({
  // `fonts.ts` is a renderer-only side-effect module that imports a `.css` file
  // and a font package; Vite consumes it directly from `src` via the `./fonts`
  // export, so it is not part of the tsdown (library) build.
  entry: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.d.ts',
    '!src/cli/**',
    '!src/fonts.ts'
  ],
  unbundle: true,
  platform: 'neutral',
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: './dist',
  deps: {
    neverBundle: [...Object.keys(packageJSON.dependencies ?? {}), /^node:/],
    onlyBundle: false
  }
})

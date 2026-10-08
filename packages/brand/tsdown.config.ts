import { readFileSync } from 'node:fs'

import { defineConfig } from 'tsdown'

const packageJSON = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
) as {
  dependencies?: Record<string, string>
}

export default defineConfig({
  entry: ['src/**/*.ts', '!src/**/*.test.ts', '!src/**/*.d.ts', '!src/cli/**'],
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

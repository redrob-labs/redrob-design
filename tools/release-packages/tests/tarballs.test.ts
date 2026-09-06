import { describe, expect, test } from 'bun:test'

import { packageBinTargets, packageExportTargetPaths } from '../src/tarballs'

describe('packageBinTargets', () => {
  test('normalizes string bin fields', () => {
    expect(packageBinTargets({ name: '@redrob-design/cli', bin: './bin/redrobdesign.js' })).toEqual(
      {
        '@redrob-design/cli': './bin/redrobdesign.js'
      }
    )
  })

  test('keeps named bin fields', () => {
    expect(
      packageBinTargets({
        name: '@redrob-design/cli',
        bin: { redrobdesign: './bin/redrobdesign.js' }
      })
    ).toEqual({
      redrobdesign: './bin/redrobdesign.js'
    })
  })
})

describe('package export targets', () => {
  test('collects wildcard targets from conditional exports', () => {
    expect(
      packageExportTargetPaths({ exports: { './feature/*': { import: './dist/*.js' } } })
    ).toEqual(['./dist/*.js'])
  })

  test('collects nested wildcard targets from conditional exports', () => {
    expect(
      packageExportTargetPaths({ exports: { './feature/*': { import: './dist/*.js' } } })
    ).toEqual(['./dist/*.js'])
  })

  test('collects targets from conditional exports', () => {
    expect(
      packageExportTargetPaths({
        exports: {
          '.': { types: './dist/index.d.ts', import: './dist/index.js' },
          './feature': { import: './dist/feature.js' }
        }
      })
    ).toEqual(['./dist/index.d.ts', './dist/index.js', './dist/feature.js'])
  })
})

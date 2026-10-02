import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  PALETTE_CLASS_MIGRATION_ALLOWLIST,
  paletteClassDiagnostics
} from '../src/steiger-rules/palette-classes'

const repoRoot = join(import.meta.dir, '..', '..', '..')

const VUE = 'src/components/example/Example.vue'
const THEME = 'src/theme/example.ts'

function vue(classes: string) {
  return `<template><div class="${classes}" /></template>`
}

describe('raw palette classes', () => {
  test('allows semantic tokens and non-colour utilities', () => {
    expect(
      paletteClassDiagnostics(
        VUE,
        vue(
          'bg-panel text-surface border-border hover:bg-hover bg-accent/10 text-on-accent ring-panel-focus text-xs shadow-md from-transparent'
        )
      )
    ).toEqual([])
  })

  test('reports palette classes with shades, opacity and variants', () => {
    const diagnostics = paletteClassDiagnostics(
      VUE,
      vue('bg-zinc-800 hover:text-white data-[state=on]:border-red-500/40 ring-black/[0.2]')
    )
    expect(diagnostics.map((d) => d.message.match(/"([^"]+)"/)?.[1])).toEqual([
      'bg-zinc-800',
      'text-white',
      'border-red-500/40',
      'ring-black/[0.2]'
    ])
  })

  test('reports arbitrary hex and functional colours', () => {
    const source =
      "export default { slots: { root: 'bg-[#1e1e1e] shadow-[0_8px_30px_rgb(0_0_0/0.4)]' } }"
    expect(paletteClassDiagnostics(THEME, source)).toHaveLength(2)
  })

  test('reports the line of each violation', () => {
    const [diagnostic] = paletteClassDiagnostics(THEME, "const a = 'p-2'\nconst b = 'bg-white'\n")
    expect(diagnostic?.line).toBe(2)
  })

  test('skips allowlisted files and files outside app UI', () => {
    const source = vue('bg-white')
    expect(paletteClassDiagnostics(VUE, source, new Set([VUE]))).toEqual([])
    expect(paletteClassDiagnostics('packages/vue/src/Demo.vue', source)).toEqual([])
    expect(paletteClassDiagnostics('src/app/editor/export.ts', "'bg-white'")).toEqual([])
  })

  test('does not mistake token names that contain a palette word', () => {
    expect(
      paletteClassDiagnostics(VUE, vue('text-warning-text bg-success-bg accent-hover text-red'))
    ).toEqual([])
  })
})

describe('palette migration allow-list', () => {
  test('only lists files that still need it, so a cleaned file cannot regress silently', () => {
    const stale = [...PALETTE_CLASS_MIGRATION_ALLOWLIST].filter((file) => {
      const source = readFileSync(join(repoRoot, file), 'utf8')
      return paletteClassDiagnostics(file, source, new Set()).length === 0
    })
    expect(stale).toEqual([])
  })
})

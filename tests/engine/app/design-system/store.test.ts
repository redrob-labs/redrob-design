import { afterEach, describe, expect, test } from 'bun:test'

import type { DesignToken } from '@redrob-design/brand'

import {
  activeDesignSystem,
  applyImportedDesignTokens,
  clearStoredDesignSystem,
  readStoredDesignSystem
} from '@/app/design-system'

const sampleTokens: DesignToken[] = [
  {
    schemaVersion: 1,
    type: 'color',
    name: 'brand.blue',
    value: '#2b52ff',
    origin: 'dtcg-json'
  },
  {
    schemaVersion: 1,
    type: 'color',
    name: 'brand.black',
    value: '#0a0b0c',
    origin: 'dtcg-json'
  },
  {
    schemaVersion: 1,
    type: 'fontFamily',
    name: 'font.sans',
    value: 'Pretendard',
    origin: 'dtcg-json'
  },
  {
    schemaVersion: 1,
    type: 'spacing',
    name: 'space.4',
    value: '16px',
    origin: 'dtcg-json'
  }
]

afterEach(() => clearStoredDesignSystem())

describe('design-system store', () => {
  test('persists imported tokens so import actually takes effect', () => {
    expect(readStoredDesignSystem()).toBeNull()

    const stored = applyImportedDesignTokens(sampleTokens, {
      sourceFiles: ['tokens.json']
    })

    // The parsed tokens are stored, not discarded.
    expect(stored.tokens).toHaveLength(sampleTokens.length)
    expect(stored.sourceFiles).toEqual(['tokens.json'])
    expect(stored.colors).toEqual(['#2b52ff', '#0a0b0c'])
    expect(stored.fonts).toEqual(['Pretendard'])
    expect(stored.spacing).toEqual(['16px'])
    expect(stored.summary).toContain('4 design tokens')

    // The persisted read reflects the same stored system.
    const read = readStoredDesignSystem()
    expect(read).not.toBeNull()
    expect(read?.tokens?.map((token) => token.name)).toEqual(sampleTokens.map((t) => t.name))
    expect(activeDesignSystem.value?.tokens).toHaveLength(sampleTokens.length)
  })

  test('replaces the stored system on a subsequent import', () => {
    applyImportedDesignTokens(sampleTokens, { sourceFiles: ['first.json'] })
    applyImportedDesignTokens([sampleTokens[0]], { sourceFiles: ['second.json'] })

    const read = readStoredDesignSystem()
    expect(read?.tokens).toHaveLength(1)
    expect(read?.sourceFiles).toEqual(['second.json'])
  })

  test('clears the stored design system', () => {
    applyImportedDesignTokens(sampleTokens, { sourceFiles: ['tokens.json'] })
    expect(readStoredDesignSystem()).not.toBeNull()

    clearStoredDesignSystem()
    expect(readStoredDesignSystem()).toBeNull()
    expect(activeDesignSystem.value).toBeNull()
  })
})

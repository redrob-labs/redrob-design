import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'

import {
  declaredProperties,
  designSystemPath,
  readDesignSystemTokens,
  referencedProperties,
  unresolvedReferences
} from '#tests/helpers/design-tokens'
import { repoPath } from '#tests/helpers/paths'

const designSystemCSS = readFileSync(designSystemPath('tokens.css'), 'utf8')

/**
 * Stylesheets that must only read custom properties something declares. Each entry is checked
 * against the union of every declaration in this list plus the design system, so a stylesheet may
 * read a token another one declares, but never one nobody does.
 */
const STYLESHEETS_UNDER_CONTRACT: readonly string[] = [repoPath('packages/brand/src/tokens.css')]

/** Variables the browser or Tailwind provides at runtime rather than any stylesheet here. */
const RUNTIME_PROVIDED = new Set<string>()

describe('design-token contract', () => {
  it('pins @redrob-labs/ui and ships both themes', () => {
    const tokens = readDesignSystemTokens()
    expect(tokens.get('blue-6')?.light).toBe('#2b52ff')
    expect(tokens.get('surface-base')?.themed).toBe(true)
    expect(designSystemCSS).toContain('[data-theme="dark"]')
  })

  it('resolves every reference inside the design system itself', () => {
    expect(unresolvedReferences([designSystemCSS], [designSystemCSS], RUNTIME_PROVIDED)).toEqual([])
  })

  it('resolves every reference in the stylesheets under contract', () => {
    const sources = STYLESHEETS_UNDER_CONTRACT.map((file) => readFileSync(file, 'utf8'))
    expect(unresolvedReferences(sources, [designSystemCSS, ...sources], RUNTIME_PROVIDED)).toEqual(
      []
    )
  })

  it('reports a misspelled token instead of letting it fail silently', () => {
    const typo = '.x { color: var(--ink-primry); background: var(--surface-base); }'
    expect(unresolvedReferences([typo], [designSystemCSS])).toEqual(['--ink-primry'])
  })

  it('treats a reference with a fallback as intentional', () => {
    const css = '.x { --own: 1px; width: var(--own); gap: var(--maybe, 4px); }'
    expect([...declaredProperties(css)]).toEqual(['--own'])
    expect([...referencedProperties(css)]).toEqual(['--own'])
  })
})

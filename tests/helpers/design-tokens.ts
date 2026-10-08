import { readFileSync } from 'node:fs'

import { repoPath } from './paths'

/**
 * Helpers for the design-token contract.
 *
 * An undeclared custom property fails silently in CSS: `color: var(--ink-primry)` is invalid at
 * computed-value time, the property falls back to its inherited value, and nothing warns. These
 * helpers let a test say "every `var()` this stylesheet names is declared somewhere it loads".
 */

// Resolve the design system the way `@redrob-design/brand` (its only declared owner) resolves it.
export function designSystemPath(subpath: 'tokens.css' | 'tokens.json'): string {
  return Bun.resolveSync(`@redrob-labs/ui/${subpath}`, repoPath('packages/brand'))
}

export interface DesignSystemToken {
  name: string
  kind: string
  light: string
  dark: string
  themed: boolean
}

export function readDesignSystemTokens(): Map<string, DesignSystemToken> {
  const json = JSON.parse(readFileSync(designSystemPath('tokens.json'), 'utf8')) as {
    tokens: DesignSystemToken[]
  }
  return new Map(json.tokens.map((token) => [token.name, token]))
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

/** Every custom property a stylesheet declares (`--name:`), in any block. */
export function declaredProperties(css: string): Set<string> {
  const out = new Set<string>()
  for (const match of stripComments(css).matchAll(/(--[\w-]+)\s*:/g)) {
    const name = match[1]
    if (name) out.add(name)
  }
  return out
}

/**
 * Every custom property a stylesheet reads with `var(--name)` and no fallback. A reference with a
 * fallback (`var(--x, 0)`) degrades on purpose, so it is not a silent failure.
 */
export function referencedProperties(css: string): Set<string> {
  const out = new Set<string>()
  for (const match of stripComments(css).matchAll(/var\(\s*(--[\w-]+)\s*(,)?/g)) {
    const name = match[1]
    if (name && match[2] === undefined) out.add(name)
  }
  return out
}

/** Names referenced by `sources` that no source in `declarations` (or the allow-list) declares. */
export function unresolvedReferences(
  sources: readonly string[],
  declarations: readonly string[],
  allow: ReadonlySet<string> = new Set()
): string[] {
  const declared = new Set<string>()
  for (const css of declarations) for (const name of declaredProperties(css)) declared.add(name)
  const missing = new Set<string>()
  for (const css of sources) {
    for (const name of referencedProperties(css)) {
      if (!declared.has(name) && !allow.has(name)) missing.add(name)
    }
  }
  return [...missing].sort()
}

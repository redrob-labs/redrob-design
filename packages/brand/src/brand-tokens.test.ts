/**
 * The `redrob-brand` token resource: does it resolve, and does it still carry the
 * values the design system publishes?
 *
 * The resource is a DESIGN.md file in the built-in scaffold collection, so the
 * first question is answered by the app's own validator plus this package's
 * resolver. The second is the one a reviewer cannot answer from a diff:
 * `@redrob-labs/ui` is where a Redrob colour is decided, its `tokens.json` resolves
 * every `var()` chain per theme, and if the resource and the package ever disagree,
 * the assertions below say which value moved.
 */

import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  loadRedrobBrandTokens,
  REDROB_BRAND_RESOURCE_ID,
  REDROB_BRAND_RESOURCE_NAME,
  REDROB_BRAND_RESOURCE_PATH,
  redrobBrandResourcePath,
  renderBrandTokenCss,
  repoRoot,
  resolveRedrobBrandTokens,
  syncDeckTokens,
  TOKEN_BLOCK_CLOSE,
  TOKEN_BLOCK_OPEN
} from './node.ts'
import { validateDesignMd } from './shared/design-md.ts'

const resourceRaw = readFileSync(redrobBrandResourcePath(), 'utf8')
const scaffoldManifest = JSON.parse(
  readFileSync(path.join(repoRoot(), 'public/resources/scaffolds/manifest.json'), 'utf8')
) as { schemaVersion: number; scaffolds: Record<string, Record<string, unknown>> }

interface PublishedToken {
  name: string
  kind: string
  light: string
  dark: string
  themed: boolean
}

const here = path.dirname(fileURLToPath(import.meta.url))
const published = new Map(
  (
    JSON.parse(readFileSync(Bun.resolveSync('@redrob-labs/ui/tokens.json', here), 'utf8')) as {
      tokens: PublishedToken[]
    }
  ).tokens.map((token) => [token.name, token])
)

/** The value `@redrob-labs/ui` resolves a token to in a theme, lower-cased. */
function publishedValue(name: string, theme: 'light' | 'dark'): string | undefined {
  return published.get(name)?.[theme].toLowerCase()
}

describe('redrob-brand token resource', () => {
  it('is a valid DESIGN.md in the built-in resource collection', () => {
    const errors = validateDesignMd(resourceRaw).filter((f) => f.severity === 'error')
    expect(errors).toEqual([])
  })

  it('is registered as a scaffold under its machine name', () => {
    const entry = scaffoldManifest.scaffolds[REDROB_BRAND_RESOURCE_ID]
    expect(entry, `scaffolds.${REDROB_BRAND_RESOURCE_ID}`).toBeDefined()
    expect(entry?.['category']).toBe('design-system')
    expect(entry?.['path']).toBe(REDROB_BRAND_RESOURCE_PATH.replace('scaffolds/', ''))
    expect(entry?.['aliases']).toContain('redrob')
  })

  it('resolves into primitives, both themes, typography and scales', async () => {
    const tokens = await loadRedrobBrandTokens()
    expect(tokens.name).toBe(REDROB_BRAND_RESOURCE_NAME)
    expect(Object.keys(tokens.primitives).length).toBeGreaterThanOrEqual(29)
    expect(Object.keys(tokens.light).length).toBeGreaterThanOrEqual(21)
    expect(Object.keys(tokens.dark)).toEqual(Object.keys(tokens.light))
    expect(tokens.primitives['blue-6']).toBe('#2b52ff')
    expect(tokens.light['action-primary']).toBe('#2b52ff')
    expect(tokens.dark['action-primary-hover']).toBe('#507fff')
    expect(tokens.rounded['full']).toBe('9999px')
    expect(tokens.spacing['4xl']).toBe('64px')
  })

  it('uses the design system font stacks', async () => {
    const tokens = await loadRedrobBrandTokens()
    for (const [role, value] of Object.entries(tokens.typography)) {
      const stack = publishedValue(role === 'mono' ? 'font-mono' : 'font-sans', 'light')
      expect(value.fontFamily.toLowerCase(), role).toBe(stack ?? '')
    }
  })

  it('carries the primitive HEX values @redrob-labs/ui publishes', async () => {
    const tokens = await loadRedrobBrandTokens()
    for (const [name, hex] of Object.entries(tokens.primitives)) {
      expect(published.get(name)?.themed, `${name} is themeless`).toBe(false)
      expect(publishedValue(name, 'light'), name).toBe(hex)
    }
  })

  it('resolves every semantic role to the value @redrob-labs/ui does, in both themes', async () => {
    const tokens = await loadRedrobBrandTokens()
    for (const [role, hex] of Object.entries(tokens.light)) {
      expect(publishedValue(role, 'light'), `light ${role}`).toBe(hex)
    }
    for (const [role, hex] of Object.entries(tokens.dark)) {
      expect(publishedValue(role, 'dark'), `dark ${role}`).toBe(hex)
    }
  })

  it('carries the radius scale @redrob-labs/ui publishes', async () => {
    const tokens = await loadRedrobBrandTokens()
    for (const [name, value] of Object.entries(tokens.rounded)) {
      expect(publishedValue(`radius-${name}`, 'light'), `rounded.${name}`).toBe(value)
    }
  })

  it('rejects a resource that is not a valid DESIGN.md', () => {
    expect(() => resolveRedrobBrandTokens('no frontmatter here')).toThrow(/frontmatter/i)
  })

  it('rejects a colour key that is neither a primitive nor a semantic role', () => {
    const broken = resourceRaw.replace('  blue-6:', '  brandish-blue:')
    expect(() => resolveRedrobBrandTokens(broken)).toThrow(
      /neither a primitive nor a semantic role/
    )
  })

  it('rejects a dark theme that drops a role light declares', () => {
    const broken = resourceRaw.replace(/^ {2}dark-action-primary-hover: .*$/m, '')
    expect(() => resolveRedrobBrandTokens(broken)).toThrow(/does not re-point/)
  })
})

describe('renderBrandTokenCss', () => {
  it('keeps the two-layer shape: primitives hold HEX, roles point at primitives', async () => {
    const css = renderBrandTokenCss(await loadRedrobBrandTokens())
    expect(css.startsWith(TOKEN_BLOCK_OPEN)).toBe(true)
    expect(css.endsWith(TOKEN_BLOCK_CLOSE)).toBe(true)
    expect(css).toContain('--blue-6: #2b52ff;')
    expect(css).toContain('--action-primary-hover: var(--blue-7);')
    expect(css).toContain('[data-theme="dark"] {')
    expect(css).toContain('--action-primary-hover: var(--blue-5);')
    // A role the system corrects off the scale keeps its own HEX rather than a wrong primitive.
    expect(css).toContain('--ink-muted: #686e78;')
    expect(css).toContain('--font-sans: Pretendard,')
    expect(css).toContain('--type-display-size: 72px;')
    expect(css).toContain('--radius-full: 9999px;')
  })
})

describe('syncDeckTokens', () => {
  it('throws when a deck has no generated block to fill', async () => {
    const tokens = await loadRedrobBrandTokens()
    expect(() => syncDeckTokens('<style>body{}</style>', tokens)).toThrow(/no .* block to fill/)
  })

  it('is idempotent', async () => {
    const tokens = await loadRedrobBrandTokens()
    const once = syncDeckTokens(
      `<style>\n  ${TOKEN_BLOCK_OPEN}\n  ${TOKEN_BLOCK_CLOSE}\n</style>`,
      tokens
    )
    expect(syncDeckTokens(once, tokens)).toBe(once)
  })
})

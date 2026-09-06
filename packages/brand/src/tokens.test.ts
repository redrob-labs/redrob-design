import { describe, expect, it } from 'bun:test'
/**
 * Token assertions.
 *
 * These lock the two things a stylesheet cannot enforce on its own and a reviewer cannot see in a
 * diff: that the primitive layer still holds the brand's HEX values byte for byte, and that no
 * semantic role has quietly gone back to naming a colour of its own.
 *
 * The expected values are transcribed from Console's `apps/web/src/app/globals.css`, which is the
 * other implementation of the same brand document. If the two ever disagree, one of them has drifted
 * and this test says which value it was.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(resolve(here, 'tokens.css'), 'utf8')
const fontsCss = readFileSync(resolve(here, 'fonts.css'), 'utf8')
const fontsTs = readFileSync(resolve(here, 'fonts.ts'), 'utf8')

/** The brand primitives, verbatim from Console. Every one of these is a fixed value in both themes. */
const PRIMITIVES: Record<string, string> = {
  '--rr-black': '#0a0b0c',
  '--rr-white': '#ffffff',
  '--rr-blue-1': '#eff4ff',
  '--rr-blue-3': '#bad2ff',
  '--rr-blue-4': '#8aafff',
  '--rr-blue-5': '#507fff',
  '--rr-blue-6': '#2b52ff',
  '--rr-blue-7': '#1733d5',
  '--rr-blue-9': '#061460',
  '--rr-blue-10': '#030c34',
  '--rr-gray-1': '#f8f9fb',
  '--rr-gray-2': '#eff1f4',
  '--rr-gray-3': '#dfe2e8',
  '--rr-gray-4': '#cbcfd7',
  '--rr-gray-5': '#aab0bb',
  '--rr-gray-6': '#7c8390',
  '--rr-gray-7': '#576071',
  '--rr-gray-8': '#292e37',
  '--rr-gray-9': '#141719',
  '--rr-orange-3': '#ff9c1b',
  '--rr-orange-4': '#ae5100',
  '--rr-green-3': '#29e474',
  '--rr-green-4': '#00864a',
  '--rr-red-3': '#ff5452',
  '--rr-red-4': '#a31310'
}

/**
 * The semantic roles Console's correspondence table maps, and the primitive each one must land on
 * per theme. `null` means the role is a documented mix or alias rather than a bare primitive, and is
 * covered by the "names no colour of its own" assertion instead.
 */
const SEMANTICS: Record<string, { light: string | null; dark: string | null }> = {
  '--color-background': { light: '--rr-gray-1', dark: '--rr-gray-9' },
  '--color-background-secondary': { light: '--rr-gray-2', dark: '--rr-black' },
  '--color-surface': { light: '--rr-white', dark: null },
  '--color-surface-hover': { light: '--rr-gray-2', dark: null },
  '--color-surface-active': { light: '--rr-gray-3', dark: '--rr-gray-8' },
  '--color-surface-muted': { light: '--rr-gray-2', dark: '--rr-gray-8' },
  '--color-surface-elevated': { light: '--rr-white', dark: null },
  '--color-artifact-bg': { light: '--rr-white', dark: '--rr-white' },
  '--color-border': { light: '--rr-gray-3', dark: '--rr-gray-8' },
  '--color-border-subtle': { light: '--rr-gray-2', dark: null },
  '--color-border-strong': { light: '--rr-gray-4', dark: '--rr-gray-7' },
  '--color-accent': { light: '--rr-blue-6', dark: '--rr-blue-5' },
  '--color-accent-hover': { light: '--rr-blue-7', dark: '--rr-blue-4' },
  '--color-accent-muted': { light: '--rr-blue-3', dark: '--rr-blue-9' },
  '--color-accent-soft': { light: '--rr-blue-1', dark: '--rr-blue-10' },
  '--color-focus-ring': { light: '--rr-blue-6', dark: '--rr-blue-5' },
  '--color-on-accent': { light: '--rr-white', dark: '--rr-black' },
  '--color-text-primary': { light: '--rr-gray-9', dark: '--rr-gray-1' },
  '--color-text-secondary': { light: '--rr-gray-7', dark: '--rr-gray-5' },
  '--color-text-muted': { light: '--rr-gray-6', dark: '--rr-gray-6' },
  '--color-success': { light: '--rr-green-4', dark: '--rr-green-3' },
  '--color-warning': { light: '--rr-orange-4', dark: '--rr-orange-3' },
  '--color-error': { light: '--rr-red-4', dark: '--rr-red-3' },
  '--color-mcp': { light: '--rr-blue-6', dark: '--rr-blue-4' },
  '--color-toast-success': { light: '--rr-green-4', dark: '--rr-green-3' },
  '--color-toast-error': { light: '--rr-red-4', dark: '--rr-red-3' }
}

/** Roles that are this app's own and deliberately have no Console counterpart. */
const APP_ONLY_ROLES = new Set([
  '--color-border-muted',
  '--color-accent-tint',
  '--color-overlay',
  '--color-phone-body',
  '--color-phone-island'
])

/** Everything inside the first `:root { ... }` block, which is where light lives. */
function block(selector: string): string {
  const start = css.indexOf(`${selector} {`)
  expect(start, `${selector} block is missing from tokens.css`).toBeGreaterThan(-1)
  const end = css.indexOf('\n}', start)
  return css.slice(start, end)
}

/** Declared custom properties in a block, last declaration winning, comments stripped. */
function declarations(source: string): Map<string, string> {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '')
  const out = new Map<string, string>()
  for (const match of withoutComments.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    out.set(match[1] as string, (match[2] as string).replace(/\s+/g, ' ').trim())
  }
  return out
}

const light = declarations(block(':root'))
const dark = declarations(block('.dark'))

describe('primitives', () => {
  it('holds the brand HEX values Console holds', () => {
    for (const [name, value] of Object.entries(PRIMITIVES)) {
      expect(light.get(name), `${name} must be the brand value`).toBe(value)
    }
  })

  it('declares no primitive twice and none in the dark theme', () => {
    for (const name of dark.keys()) {
      expect(name.startsWith('--rr-'), `${name} re-points a primitive in .dark`).toBe(false)
    }
    const declared = [
      ...(css.matchAll(/^\s*(--rr-[\w-]+):/gm) as unknown as Iterable<string[]>)
    ].map((m) => m[1] as string)
    expect(new Set(declared).size).toBe(declared.length)
  })

  it('declares no primitive the semantic layer never names', () => {
    for (const name of Object.keys(PRIMITIVES)) {
      const uses = css.split(`var(${name})`).length - 1
      expect(uses, `${name} is declared and never used`).toBeGreaterThan(0)
    }
  })
})

describe('semantics', () => {
  it('maps every Console-shared role to the primitive Console maps it to', () => {
    for (const [role, expected] of Object.entries(SEMANTICS)) {
      if (expected.light !== null) {
        expect(light.get(role), `${role} in light`).toBe(`var(${expected.light})`)
      }
      if (expected.dark !== null) {
        expect(dark.get(role), `${role} in dark`).toBe(`var(${expected.dark})`)
      }
    }
  })

  it('names no colour of its own: no role holds a literal value', () => {
    for (const [theme, decls] of [
      ['light', light],
      ['dark', dark]
    ] as const) {
      for (const [name, value] of decls) {
        if (!name.startsWith('--color-')) continue
        // The phone frame is a physical object rather than a themed surface, so its two roles hold
        // their own oklch values on purpose. Named here so the exemption is a decision, not a gap.
        if (name === '--color-phone-body' || name === '--color-phone-island') continue
        expect(
          /#[0-9a-f]{3,8}\b/i.test(value),
          `${name} in ${theme} hardcodes ${value} instead of naming a primitive`
        ).toBe(false)
      }
    }
  })

  it('re-points every themed role in both themes', () => {
    for (const role of Object.keys(SEMANTICS)) {
      expect(light.has(role), `${role} missing from light`).toBe(true)
      expect(dark.has(role), `${role} missing from dark`).toBe(true)
    }
    for (const name of dark.keys()) {
      if (!name.startsWith('--color-') && !name.startsWith('--shadow-')) continue
      expect(light.has(name), `${name} exists only in dark`).toBe(true)
    }
  })

  it('accounts for every colour role, so a new one cannot arrive undocumented', () => {
    const known = new Set([...Object.keys(SEMANTICS), ...APP_ONLY_ROLES])
    for (const name of light.keys()) {
      if (!name.startsWith('--color-')) continue
      expect(known.has(name), `${name} is a colour role this test does not know about`).toBe(true)
    }
  })

  it('draws the focus ring at full opacity, not as a wash', () => {
    for (const decls of [light, dark]) {
      expect(decls.get('--color-focus-ring')).not.toContain('transparent')
      expect(decls.get('--color-focus-ring')).not.toContain('color-mix')
    }
  })

  it('tints shadows with a primitive in both themes', () => {
    for (const [theme, decls] of [
      ['light', light],
      ['dark', dark]
    ] as const) {
      for (const level of ['--shadow-soft', '--shadow-card', '--shadow-elevated']) {
        const value = decls.get(level) as string
        expect(value, `${level} in ${theme}`).toContain('var(--rr-')
        expect(value, `${level} in ${theme} still uses a raw colour`).not.toMatch(
          /oklch|#[0-9a-f]{3}/i
        )
      }
    }
  })
})

describe('type', () => {
  it('leads the sans stack with Pretendard', () => {
    const sans = light.get('--font-sans') as string
    expect(sans.startsWith('"Pretendard Variable", Pretendard,')).toBe(true)
    expect(sans).toContain('sans-serif')
  })

  it('aliases display to sans rather than naming a second face', () => {
    expect(light.get('--font-display')).toBe('var(--font-sans)')
  })

  it('leads the mono stack with JetBrains Mono', () => {
    const mono = light.get('--font-mono') as string
    expect(mono.startsWith('"JetBrains Mono Variable", "JetBrains Mono",')).toBe(true)
    expect(mono).toContain('monospace')
  })

  it('names no non-product typeface in any declaration', () => {
    // Comments stripped: the prose above says which faces were dropped and why, and saying so is
    // not the same as loading one.
    const code = (source: string) =>
      source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    for (const banned of ['Geist', 'Fraunces', 'Inter', 'Times New Roman']) {
      expect(code(css), `${banned} is not product typography`).not.toContain(banned)
      expect(code(fontsTs), `${banned} is not loaded`).not.toContain(banned)
    }
  })

  it('registers Pretendard from a vendored file rather than a network fetch', () => {
    expect(fontsCss).toContain('font-family: "Pretendard Variable"')
    expect(fontsCss).toContain('format("woff2-variations")')
    expect(fontsCss).not.toMatch(/https?:\/\//)
    expect(existsSync(resolve(here, 'assets/fonts/pretendard/PretendardVariable.woff2'))).toBe(true)
    expect(existsSync(resolve(here, 'assets/fonts/pretendard/LICENSE.txt'))).toBe(true)
  })
})

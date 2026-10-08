import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

import { DEFAULT_APP_THEME, resolveAppTheme, THEME_STORAGE_KEY } from '@/app/shell/theme'

import { repoPath } from '#tests/helpers/paths'

describe('app theme default', () => {
  test('a fresh install with nothing stored starts in light', () => {
    expect(DEFAULT_APP_THEME).toBe('light')
    expect(resolveAppTheme(null, false)).toBe('light')
    expect(resolveAppTheme(null, true)).toBe('light')
  })

  test('a saved choice is kept', () => {
    expect(resolveAppTheme('dark', false)).toBe('dark')
    expect(resolveAppTheme('light', true)).toBe('light')
    expect(resolveAppTheme('auto', true)).toBe('dark')
    expect(resolveAppTheme('auto', false)).toBe('light')
  })

  test('an unrecognised stored value falls back to the default instead of painting no theme', () => {
    expect(resolveAppTheme('"dark"', true)).toBe('light')
    expect(resolveAppTheme('sepia', false)).toBe('light')
  })
})

/**
 * index.html resolves the theme inline so the boot splash never flashes the wrong theme. It has to
 * agree with resolveAppTheme(); run it against the same cases.
 */
describe('index.html theme boot script', () => {
  const html = readFileSync(repoPath('index.html'), 'utf8')
  const source = /<script id="theme-boot">([\s\S]*?)<\/script>/.exec(html)?.[1]

  function runBoot(stored: string | null, prefersDark: boolean) {
    const root = { dataset: {} as Record<string, string>, style: {} as Record<string, string> }
    const storage = {
      getItem: (key: string) => (key === THEME_STORAGE_KEY ? stored : null)
    }
    const matchMedia = () => ({ matches: prefersDark })
    // oxlint-disable-next-line no-new-func -- executes the static inline script under test
    new Function('localStorage', 'matchMedia', 'document', source ?? '')(storage, matchMedia, {
      documentElement: root
    })
    return root
  }

  test('is present and reads the same storage key', () => {
    expect(source).toBeDefined()
    expect(source).toContain(`'${THEME_STORAGE_KEY}'`)
  })

  test('matches resolveAppTheme for every stored value', () => {
    for (const stored of [null, 'dark', 'light', 'auto', 'sepia']) {
      for (const prefersDark of [false, true]) {
        const root = runBoot(stored, prefersDark)
        const expected = resolveAppTheme(stored, prefersDark)
        expect(root.dataset['theme'], `${stored} / ${prefersDark}`).toBe(expected)
        expect(root.style['colorScheme']).toBe(expected)
      }
    }
  })
})

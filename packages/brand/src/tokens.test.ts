import { describe, expect, it } from 'bun:test'
/**
 * `tokens.css` is a re-export of the Redrob Group Design System 2026, not a transcription of it.
 *
 * These lock that shape: the file names the package's token layer and nothing else, so no Redrob
 * colour can be decided here again, and every font face the package declares actually ships with
 * it, because an `@font-face` whose file is missing fails silently and the stack falls through to a
 * system face.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(resolve(here, 'tokens.css'), 'utf8')
const code = css.replace(/\/\*[\s\S]*?\*\//g, '').trim()

const designSystemTokensPath = Bun.resolveSync('@redrob-labs/ui/tokens.css', here)
const designSystemCSS = readFileSync(designSystemTokensPath, 'utf8')

describe('tokens.css', () => {
  it('re-exports the design system token layer and declares nothing of its own', () => {
    expect(code).toBe("@import '@redrob-labs/ui/tokens.css';")
  })

  it('does not pull in the component classes or the page preflight', () => {
    expect(code).not.toContain('styles.css')
    expect(code).not.toContain('preflight.css')
  })
})

describe('@redrob-labs/ui token layer', () => {
  it('switches themes on the data-theme attribute the app sets', () => {
    expect(designSystemCSS).toContain(':root, [data-theme="light"]')
    expect(designSystemCSS).toContain('[data-theme="dark"]')
  })

  it('carries Redrob Blue as the primary action in both themes', () => {
    expect(designSystemCSS).toContain('--blue-6: #2b52ff;')
    expect(designSystemCSS).toContain('--action-primary: var(--blue-6);')
  })

  it('leads the sans stack with Pretendard', () => {
    expect(designSystemCSS).toMatch(/--font-sans:\s*Pretendard,/)
  })

  it('ships every font file its @font-face rules name', () => {
    const urls = [...designSystemCSS.matchAll(/url\("([^"]+\.woff2)"\)/g)].map(
      (match) => match[1] as string
    )
    expect(urls.length).toBeGreaterThanOrEqual(14)
    for (const url of urls) {
      expect(url, 'font URLs stay relative to the package').not.toMatch(/^https?:/)
      expect(existsSync(resolve(dirname(designSystemTokensPath), url)), url).toBe(true)
    }
  })
})

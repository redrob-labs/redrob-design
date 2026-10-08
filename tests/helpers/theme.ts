import type { Page } from '@playwright/test'

/**
 * Sets the app theme through its own module, not raw storage, so the watcher
 * applies it to the document and the canvas.
 */
export async function setAppTheme(page: Page, value: 'dark' | 'light'): Promise<void> {
  await page.evaluate(async (next) => {
    const themeModulePath = '/src/app/shell/theme.ts'
    const themeModule = await import(themeModulePath)
    themeModule.useAppTheme().setTheme(next)
  }, value)
  await page.waitForFunction((next) => document.documentElement.dataset.theme === next, value)
}

/**
 * The computed colour a design token resolves to in the current theme, as
 * `rgb(...)`, so a test asserts "uses this token" rather than a hex that
 * changes whenever the design system does.
 */
export async function tokenColor(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement('span')
    probe.style.color = `var(${name})`
    document.body.append(probe)
    const color = getComputedStyle(probe).color
    probe.remove()
    return color
  }, token)
}

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

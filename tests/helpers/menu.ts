import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

/** Opens the Redrob Design mark's main menu at the top-left of the window. */
export async function openMainMenu(page: Page): Promise<Locator> {
  const content = page.getByTestId('app-main-menu-content')
  if (!(await content.isVisible())) await page.getByTestId('app-main-menu').click()
  await expect(content).toBeVisible()
  return content
}

/** Opens one of the main menu's groups (File, Edit, View...) and returns its submenu. */
export async function openMenuGroup(page: Page, group: string): Promise<Locator> {
  await openMainMenu(page)
  const id = group.toLowerCase()
  await page.getByTestId(`menubar-${id}`).click()
  const content = page.getByTestId(`menubar-${id}-content`)
  await expect(content).toBeVisible()
  return content
}

/** Opens an item inside a main menu group, by its accessible name. */
export async function runMenuItem(page: Page, group: string, name: string | RegExp) {
  const content = await openMenuGroup(page, group)
  await content.getByRole('menuitem', { name }).first().click()
}

/** Opens Settings from the main menu. */
export async function openSettingsFromMenu(page: Page): Promise<void> {
  await openMainMenu(page)
  await page.getByTestId('app-settings-trigger').click()
  await expect(page.getByTestId('app-settings-dialog')).toBeVisible()
}

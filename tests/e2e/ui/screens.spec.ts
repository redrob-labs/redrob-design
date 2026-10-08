import { expect, test } from '@playwright/test'

import { openSettingsFromMenu } from '#tests/helpers/menu'
import {
  SWEEP_THEMES,
  auditSurface,
  closesWithEscape,
  openSweepApp,
  useTheme,
  type SweepIssue
} from '#tests/helpers/ui/sweep'

/**
 * Every screen, popup and menu opens, renders inside the window in both
 * themes without spilled text, unnamed controls or console errors, and
 * closes again. Screenshots land in `scratch/ui-sweep/` for a look by eye.
 */
test.describe.configure({ timeout: 90_000 })

const SETTINGS_SECTIONS = ['general', 'mcp', 'storage', 'cloud', 'usage', 'diagnostics'] as const

test('Home renders cleanly in both themes', async ({ page }) => {
  const errors = await openSweepApp(page)
  const issues: SweepIssue[] = []
  await page.getByTestId('tabbar-new').click()
  const home = page.getByTestId('recent-files-home')
  await expect(home).toBeVisible()
  for (const theme of SWEEP_THEMES) {
    await useTheme(page, theme)
    issues.push(...(await auditSurface(page, home, 'home', theme, errors)))
    await page.getByTestId('home-new-presets').click()
    const presets = page.getByRole('menu')
    issues.push(...(await auditSurface(page, presets, 'home-new-presets', theme, errors)))
    issues.push(...(await closesWithEscape(page, presets, 'home-new-presets')))
  }
  expect(issues).toEqual([])
})

test('every Settings section renders cleanly in both themes', async ({ page }) => {
  const errors = await openSweepApp(page)
  const issues: SweepIssue[] = []
  await openSettingsFromMenu(page)
  const dialog = page.getByTestId('app-settings-dialog')
  for (const theme of SWEEP_THEMES) {
    await useTheme(page, theme)
    for (const section of SETTINGS_SECTIONS) {
      await page.getByTestId(`settings-section-${section}`).click()
      await expect(page.getByTestId(`settings-section-${section}`)).toHaveAttribute(
        'data-state',
        'active'
      )
      issues.push(...(await auditSurface(page, dialog, `settings-${section}`, theme, errors)))
    }
  }
  issues.push(...(await closesWithEscape(page, dialog, 'settings')))
  expect(issues).toEqual([])
})

test('the MCP connection delete confirmation renders cleanly', async ({ page }) => {
  const errors = await openSweepApp(page)
  const issues: SweepIssue[] = []
  await openSettingsFromMenu(page)
  await page.getByTestId('settings-section-mcp').click()
  const connections = page.locator('[data-mcp-connections]')
  await connections.getByRole('button', { name: 'Add connection', exact: true }).click()
  await connections.getByLabel('Connection name').fill('Sweep server')
  await connections.getByLabel('MCP server URL').fill('https://example.com/mcp')
  await connections.getByRole('button', { name: 'Save' }).click()
  await connections.getByRole('button', { name: /Sweep server/ }).click()
  for (const theme of SWEEP_THEMES) {
    await useTheme(page, theme)
    await connections.getByRole('button', { name: 'Delete connection' }).click()
    const confirm = page.getByRole('alertdialog')
    issues.push(...(await auditSurface(page, confirm, 'confirm-delete-mcp', theme, errors)))
    issues.push(...(await closesWithEscape(page, confirm, 'confirm-delete-mcp')))
  }
  expect(issues).toEqual([])
})

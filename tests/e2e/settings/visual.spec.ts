import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { openSettingsFromMenu } from '#tests/helpers/menu'
import { setAppTheme } from '#tests/helpers/theme'

test.use({ viewport: { width: 1440, height: 900 } })

test('Settings matches the approved layout at 1440 x 900', async ({ page }) => {
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  await setAppTheme(page, 'light')
  await openSettingsFromMenu(page)

  const dialog = page.getByTestId('app-settings-dialog')
  const nav = dialog.getByRole('navigation')
  await expect(nav.getByRole('button')).toHaveText([
    'General',
    'Agents and MCP',
    'Storage',
    'Usage',
    'Diagnostics'
  ])
  await expect(dialog).toHaveScreenshot('settings-general-light.png', { animations: 'disabled' })
  const box = await dialog.boundingBox()
  expect(Math.round(box?.width ?? 0)).toBe(900)
})

test('model keys open inside Agents and MCP', async ({ page }) => {
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  await page.evaluate(async () => {
    const modulePath = '/src/app/settings/dialog.ts'
    const dialog = await import(modulePath)
    dialog.openSettingsDialog('ai')
  })
  await expect(page.getByTestId('settings-section-mcp')).toHaveAttribute('data-state', 'active')
  await expect(page.getByTestId('settings-ai-panel')).toBeInViewport()
})

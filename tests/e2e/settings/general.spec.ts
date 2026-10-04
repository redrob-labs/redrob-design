import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { openMenuGroup, openSettingsFromMenu } from '#tests/helpers/menu'

test('language can be changed from General settings and persists', async ({ page }) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()

  await openSettingsFromMenu(page)
  await page.getByTestId('settings-language').click()
  await page.getByRole('option', { name: 'Русский' }).click()
  await expect(page.getByTestId('app-settings-dialog')).toContainText('Настройки')

  await page.reload()
  await canvas.waitForInit()
  await openSettingsFromMenu(page)
  await expect(page.getByTestId('settings-language')).toContainText('Русский')

  await page.getByTestId('settings-language').click()
  await page.getByRole('option', { name: 'English' }).click()
  await expect(page.getByTestId('app-settings-dialog')).toContainText('Settings')
})

test('general snapping preferences persist and apply to editor sessions', async ({ page }) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()

  await openSettingsFromMenu(page)
  await expect(page.getByTestId('settings-general-panel')).toBeVisible()
  const geometry = page.getByRole('switch', { name: 'Snap to geometry' })
  const objects = page.getByRole('switch', { name: 'Snap to other layers' })
  const pixelGrid = page.getByRole('switch', { name: 'Snap to pixel grid' })
  await expect(geometry).toBeChecked()
  await expect(objects).toBeChecked()
  await expect(pixelGrid).toBeChecked()

  await geometry.click()
  await objects.click()
  await pixelGrid.click()
  await expect
    .poll(() =>
      page.evaluate(() => window.redrobDesign?.getStore?.().state.snappingPreferences ?? null)
    )
    .toEqual({ geometry: false, objects: false, pixelGrid: false })

  await page.getByTestId('app-settings-done').click()
  await page.reload()
  await canvas.waitForInit()
  await openSettingsFromMenu(page)
  await expect(geometry).not.toBeChecked()
  await expect(objects).not.toBeChecked()
  await expect(pixelGrid).not.toBeChecked()
  await expect(
    page.evaluate(() => window.redrobDesign?.getStore?.().state.snappingPreferences ?? null)
  ).resolves.toEqual({ geometry: false, objects: false, pixelGrid: false })

  await geometry.click()
  await objects.click()
  await pixelGrid.click()
})

test('progressive tiled rendering preference persists and URL overrides take precedence', async ({
  page
}) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()

  await openSettingsFromMenu(page)
  const tiled = page.getByRole('switch', { name: 'Progressive tiled canvas rendering' })
  await expect(tiled).not.toBeChecked()
  await tiled.click()
  await expect(page.getByText('Reload Redrob Design to apply this change.')).toBeVisible()

  await page.reload()
  await canvas.waitForInit()
  await openSettingsFromMenu(page)
  await expect(tiled).toBeChecked()
  await expect(
    page.evaluate(() =>
      window.redrobDesign
        ?.getStore?.()
        .canvasRenderers.some(
          (renderer) => renderer.tracksSceneSettlement && renderer.tiledSceneEnabled
        )
    )
  ).resolves.toBe(true)

  await page.goto('/?test&renderer=retained')
  await canvas.waitForInit()
  await openSettingsFromMenu(page)
  await expect(tiled).toBeChecked()
  await expect(
    page.getByText(/current session renderer is controlled by a URL override/i)
  ).toBeVisible()
  await expect(
    page.evaluate(() =>
      window.redrobDesign
        ?.getStore?.()
        .canvasRenderers.every(
          (renderer) => !renderer.tracksSceneSettlement || !renderer.tiledSceneEnabled
        )
    )
  ).resolves.toBe(true)

  await tiled.click()
})

test('Preferences menu snapping controls use the same preferences', async ({ page }) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()

  await openMenuGroup(page, 'View')
  await page.getByRole('menuitem', { name: 'Preferences' }).hover()
  const geometry = page.getByRole('menuitemcheckbox', { name: 'Snap to geometry' })
  const objects = page.getByRole('menuitemcheckbox', { name: 'Snap to objects' })
  const pixelGrid = page.getByRole('menuitemcheckbox', { name: 'Snap to pixel grid' })
  await expect(geometry).toBeChecked()
  await expect(objects).toBeChecked()
  await expect(pixelGrid).toBeChecked()
  await objects.click()

  await openSettingsFromMenu(page)
  await expect(page.getByRole('switch', { name: 'Snap to other layers' })).not.toBeChecked()
  await page.getByRole('switch', { name: 'Snap to other layers' }).click()
})

test('settings shortcut preserves the last visited section', async ({ page }) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()

  await openSettingsFromMenu(page)
  await page.getByTestId('settings-section-storage').click()
  await page.getByTestId('app-settings-done').click()

  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+,' : 'Control+,')
  await expect(page.getByTestId('settings-media-panel')).toBeVisible()
})

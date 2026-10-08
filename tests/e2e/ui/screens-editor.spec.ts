import { expect, test, type Locator, type Page } from '@playwright/test'

import { openMainMenu } from '#tests/helpers/menu'
import {
  SWEEP_THEMES,
  auditSurface,
  closesWithEscape,
  openSweepApp,
  useTheme,
  type ConsoleWatch,
  type SweepIssue,
  type SweepTheme
} from '#tests/helpers/ui/sweep'

/**
 * Edit mode: the main menu and each of its groups, the canvas context menu,
 * the command palette, toolbar and property popovers, the left panel tabs,
 * and the dialogs they open, in both themes.
 */
test.describe.configure({ timeout: 120_000 })

/** A frame with a fill and a component, so selection menus and assets have something to show. */
async function seedPage(page: Page): Promise<void> {
  await page.evaluate(() => {
    const store = window.redrobDesign?.getStore?.()
    if (!store) throw new Error('Editor store is not exposed')
    const pageId = store.state.currentPageId
    store.graph.createNode('FRAME', pageId, {
      name: 'Card',
      x: 200,
      y: 200,
      width: 240,
      height: 160,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    store.graph.createNode('COMPONENT', pageId, {
      name: 'Button',
      componentKey: 'sweep-button',
      x: 520,
      y: 200,
      width: 96,
      height: 32
    })
    store.requestRender()
  })
}

async function selectCard(page: Page): Promise<void> {
  await page.evaluate(() => {
    const store = window.redrobDesign?.getStore?.()
    const card = [...(store?.graph.nodes.values() ?? [])].find((node) => node.name === 'Card')
    if (!store || !card) throw new Error('Seeded card is missing')
    store.select([card.id])
  })
}

async function rightClickCanvas(page: Page, x: number, y: number): Promise<void> {
  const box = await page.getByTestId('canvas-element').boundingBox()
  if (!box) throw new Error('Canvas has no bounding box')
  await page.mouse.click(box.x + x, box.y + y, { button: 'right' })
}

/** Audits a surface and closes it with Escape, for surfaces that should. */
async function auditAndClose(
  page: Page,
  surface: Locator,
  name: string,
  theme: SweepTheme,
  errors: ConsoleWatch
): Promise<SweepIssue[]> {
  await expect(surface).toBeVisible()
  return [
    ...(await auditSurface(page, surface, name, theme, errors)),
    ...(await closesWithEscape(page, surface, name))
  ]
}

test('the main menu and each of its groups render cleanly', async ({ page }) => {
  const errors = await openSweepApp(page)
  await seedPage(page)
  const issues: SweepIssue[] = []
  for (const theme of SWEEP_THEMES) {
    await useTheme(page, theme)
    const menu = await openMainMenu(page)
    issues.push(...(await auditSurface(page, menu, 'main-menu', theme, errors)))
    const groups = await menu
      .getByRole('menuitem')
      .evaluateAll(
        (elements) =>
          elements.filter((element) => element.getAttribute('aria-haspopup') === 'menu').length
      )
    expect(groups).toBeGreaterThan(5)
    for (const id of [
      'menubar-file',
      'menubar-edit',
      'menubar-view',
      'menubar-object',
      'menubar-text',
      'menubar-arrange',
      'menubar-help'
    ]) {
      await page.getByTestId(id).hover()
      await page.getByTestId(id).click()
      const group = page.getByTestId(`${id}-content`)
      await expect(group).toBeVisible()
      issues.push(...(await auditSurface(page, group, id, theme, errors)))
    }
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('app-main-menu-content')).toBeHidden()
  }
  expect(issues).toEqual([])
})

test('the canvas context menu renders cleanly on the canvas', async ({ page }) => {
  const errors = await openSweepApp(page)
  await seedPage(page)
  const issues: SweepIssue[] = []
  const menu = page.locator('[role="menu"]')
  for (const theme of SWEEP_THEMES) {
    await useTheme(page, theme)
    await rightClickCanvas(page, 60, 600)
    issues.push(...(await auditAndClose(page, menu, 'context-menu-canvas', theme, errors)))
  }
  expect(issues).toEqual([])
})

test('the canvas context menu fits the window on a layer', async ({ page }) => {
  const errors = await openSweepApp(page)
  await seedPage(page)
  const issues: SweepIssue[] = []
  const menu = page.locator('[role="menu"]')
  for (const theme of SWEEP_THEMES) {
    await useTheme(page, theme)
    await selectCard(page)
    await rightClickCanvas(page, 320, 280)
    issues.push(...(await auditAndClose(page, menu, 'context-menu-layer', theme, errors)))
  }
  expect(issues).toEqual([])
})

test('the command palette and zoom menu render cleanly', async ({ page }) => {
  const errors = await openSweepApp(page)
  const issues: SweepIssue[] = []
  const shortcut = process.platform === 'darwin' ? 'Meta+KeyK' : 'Control+KeyK'
  for (const theme of SWEEP_THEMES) {
    await useTheme(page, theme)
    await page.keyboard.press(shortcut)
    const palette = page.getByRole('dialog', { name: 'Command palette' })
    issues.push(...(await auditAndClose(page, palette, 'command-palette', theme, errors)))
    await page.getByTestId('zoom-dropdown-trigger').click()
    issues.push(...(await auditAndClose(page, page.getByRole('menu'), 'zoom-menu', theme, errors)))
  }
  expect(issues).toEqual([])
})

test('the fill picker and property panel render cleanly', async ({ page }) => {
  const errors = await openSweepApp(page)
  await seedPage(page)
  await selectCard(page)
  const issues: SweepIssue[] = []
  for (const theme of SWEEP_THEMES) {
    await useTheme(page, theme)
    const properties = page.getByTestId('properties-panel')
    if (await properties.isVisible()) {
      issues.push(...(await auditSurface(page, properties, 'properties-panel', theme, errors)))
    }
    await page.getByTestId('fill-picker-swatch').first().click()
    const picker = page
      .getByRole('dialog')
      .filter({ has: page.getByTestId('fill-picker-tab-solid') })
    await expect(picker).toBeVisible()
    issues.push(...(await auditSurface(page, picker, 'fill-picker', theme, errors)))
    for (const tab of ['gradient', 'image', 'solid'] as const) {
      await picker.getByTestId(`fill-picker-tab-${tab}`).click()
      issues.push(...(await auditSurface(page, picker, `fill-picker-${tab}`, theme, errors)))
    }
    issues.push(...(await closesWithEscape(page, picker, 'fill-picker')))
  }
  expect(issues).toEqual([])
})

test('the layers and assets panels and their dialogs render cleanly', async ({ page }) => {
  const errors = await openSweepApp(page)
  await seedPage(page)
  const issues: SweepIssue[] = []
  for (const theme of SWEEP_THEMES) {
    await useTheme(page, theme)
    await page.evaluate(() => window.redrobDesign?.getStore?.()?.clearSelection())
    await page.getByTestId('left-panel-layers-tab').click()
    const variables = page
      .getByRole('region', { name: 'Variables' })
      .getByRole('button', { name: 'Open variables' })
    await variables.click()
    issues.push(
      ...(await auditAndClose(
        page,
        page.getByTestId('variables-dialog'),
        'variables-dialog',
        theme,
        errors
      ))
    )
    await page.getByTestId('left-panel-assets-tab').click()
    const assets = page.getByTestId('assets-panel')
    await expect(assets).toBeVisible()
    issues.push(...(await auditSurface(page, assets, 'assets-panel', theme, errors)))
    await selectCard(page)
    await page.evaluate(() => {
      const store = window.redrobDesign?.getStore?.()
      if (store) store.state.renameSelectionOpen = true
    })
    issues.push(
      ...(await auditAndClose(page, page.getByRole('dialog'), 'rename-selection', theme, errors))
    )
  }
  expect(issues).toEqual([])
})

test('the asset details dialog renders cleanly', async ({ page }) => {
  const errors = await openSweepApp(page)
  await seedPage(page)
  const issues: SweepIssue[] = []
  for (const theme of SWEEP_THEMES) {
    await useTheme(page, theme)
    await page.getByTestId('left-panel-assets-tab').click()
    await page.getByTestId('assets-panel').getByTestId('asset-item').first().click()
    const details = page.getByTestId('asset-details-dialog')
    issues.push(...(await auditAndClose(page, details, 'asset-details', theme, errors)))
  }
  expect(issues).toEqual([])
})

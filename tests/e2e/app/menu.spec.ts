import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { openMainMenu, openMenuGroup, runMenuItem } from '#tests/helpers/menu'

const editor = useEditorSetup()

test.afterEach(async () => {
  await editor.page.keyboard.press('Escape')
  await editor.page.keyboard.press('Escape')
  await editor.page.keyboard.press('Escape')
})

test('the left panel has no menu bar', async () => {
  await expect(editor.page.locator('[role="menubar"]')).toHaveCount(0)
  await expect(editor.page.getByTestId('app-main-menu')).toBeVisible()
})

test('the mark opens the main menu with every group in order', async () => {
  const content = await openMainMenu(editor.page)
  const labels = await content.locator(':scope > [role="menuitem"]').allTextContents()
  expect(labels.map((label) => label.replace(/\s+/g, ' ').trim())).toEqual([
    'Back to Home',
    'File',
    'Edit',
    'View',
    'Object',
    'Text',
    'Arrange',
    expect.stringContaining('Settings…'),
    'Help'
  ])
})

test('the main menu works from the keyboard', async () => {
  await editor.page.getByTestId('app-main-menu').focus()
  await editor.page.keyboard.press('Enter')
  const content = editor.page.getByTestId('app-main-menu-content')
  await expect(content).toBeVisible()
  await expect(editor.page.getByTestId('app-main-menu-home')).toBeFocused()
  await editor.page.keyboard.press('ArrowDown')
  await expect(editor.page.getByTestId('menubar-file')).toBeFocused()
  await editor.page.keyboard.press('ArrowRight')
  await expect(editor.page.getByTestId('menubar-file-content')).toBeVisible()
  await editor.page.keyboard.press('Escape')
  await editor.page.keyboard.press('Escape')
  await expect(content).toBeHidden()
})

test('File menu shows open and save items', async () => {
  const menu = await openMenuGroup(editor.page, 'File')
  const items = await menu.getByRole('menuitem').allTextContents()
  expect(items.some((t) => t.includes('Open'))).toBe(true)
  expect(items.some((t) => t.includes('Open storage workspace'))).toBe(true)
  expect(items.some((t) => t.includes('Save'))).toBe(true)
  expect(items.some((t) => t.includes('Save as'))).toBe(true)
})

test('Edit menu shows Undo/Redo/Delete', async () => {
  const menu = await openMenuGroup(editor.page, 'Edit')
  const items = await menu.getByRole('menuitem').allTextContents()
  expect(items.some((t) => t.includes('Undo'))).toBe(true)
  expect(items.some((t) => t.includes('Redo'))).toBe(true)
  expect(items.some((t) => t.includes('Delete'))).toBe(true)
  expect(items.some((t) => t.includes('Select all'))).toBe(true)
})

test('View menu shows zoom options and no nested Settings', async () => {
  const menu = await openMenuGroup(editor.page, 'View')
  const items = await menu.getByRole('menuitem').allTextContents()
  expect(items.some((t) => t.includes('Zoom to fit'))).toBe(true)
  expect(items.some((t) => t.includes('Zoom in'))).toBe(true)
  expect(items.some((t) => t.includes('Zoom out'))).toBe(true)
  await menu.getByRole('menuitem', { name: 'Preferences' }).click()
  await expect(editor.page.getByRole('menuitemcheckbox', { name: 'Snap to objects' })).toBeVisible()
  await expect(editor.page.getByRole('menuitem', { name: /^Settings…/ })).toHaveCount(1)
})

test('Object menu shows Group/Ungroup/Component', async () => {
  const menu = await openMenuGroup(editor.page, 'Object')
  const items = await menu.getByRole('menuitem').allTextContents()
  expect(items.some((t) => t.includes('Group'))).toBe(true)
  expect(items.some((t) => t.includes('Ungroup'))).toBe(true)
  expect(items.some((t) => t.includes('Create component'))).toBe(true)
  expect(items.some((t) => t.includes('Bring to front'))).toBe(true)
  expect(items.some((t) => t.includes('Send to back'))).toBe(true)
})

function getStoreStateNumber(key: 'selectedIds' | 'zoom') {
  return editor.page.evaluate((stateKey) => {
    const store = window.redrobDesign?.getStore?.()
    if (!store) throw new Error('RedrobDesign store not initialized')
    if (stateKey === 'selectedIds') return store.state.selectedIds.size
    return store.state.zoom
  }, key)
}

test('Move to page is disabled without a selection', async () => {
  await editor.page.evaluate(() => {
    const store = window.redrobDesign?.getStore?.()
    if (!store) throw new Error('RedrobDesign store not initialized')
    store.addPage('Second page')
    store.switchPage(store.graph.getPages()[0].id)
  })

  let menu = await openMenuGroup(editor.page, 'Object')
  await expect(menu.getByRole('menuitem', { name: 'Move to page' })).toHaveAttribute(
    'data-disabled'
  )
  await editor.page.keyboard.press('Escape')
  await editor.page.keyboard.press('Escape')

  await editor.canvas.drawRect(200, 200, 100, 100)
  menu = await openMenuGroup(editor.page, 'Object')
  await expect(menu.getByRole('menuitem', { name: 'Move to page' })).not.toHaveAttribute(
    'data-disabled'
  )
  await editor.page.keyboard.press('Escape')
  await editor.page.keyboard.press('Escape')
  await editor.page.evaluate(() => {
    const store = window.redrobDesign?.getStore?.()
    if (!store) throw new Error('RedrobDesign store not initialized')
    for (const id of store.state.selectedIds) store.graph.deleteNode(id)
    store.clearSelection()
    store.undo.clear()
  })
})

test('Undo via Edit menu works', async () => {
  await editor.canvas.drawRect(200, 200, 100, 100)
  expect(await getStoreStateNumber('selectedIds')).toBe(1)

  await runMenuItem(editor.page, 'Edit', /^Undo/)
  await editor.canvas.waitForRender()

  expect(await getStoreStateNumber('selectedIds')).toBe(0)
})

test('Duplicate via Edit menu works', async () => {
  await editor.canvas.drawRect(300, 300, 80, 80)

  const countChildren = () =>
    editor.page.evaluate(() => {
      const store = window.redrobDesign?.getStore?.()
      if (!store) throw new Error('RedrobDesign store not initialized')
      return store.graph.getChildren(store.state.currentPageId).length
    })
  const countBefore = await countChildren()

  await runMenuItem(editor.page, 'Edit', /^Duplicate/)
  await editor.canvas.waitForRender()

  expect(await countChildren()).toBe(countBefore + 1)
})

test('Zoom to fit via View menu works', async () => {
  await runMenuItem(editor.page, 'View', /^Zoom in/)
  await editor.canvas.waitForRender()

  const zoomBefore = await getStoreStateNumber('zoom')
  expect(zoomBefore).toBeGreaterThan(1)

  await runMenuItem(editor.page, 'View', /^Zoom to fit/)
  await editor.canvas.waitForRender()

  expect(await getStoreStateNumber('zoom')).not.toBe(zoomBefore)
})

test('Help opens the command palette', async () => {
  const help = await openMenuGroup(editor.page, 'Help')
  await help.getByRole('menuitem', { name: /^Search commands…/ }).click()
  await expect(editor.page.getByRole('dialog')).toBeVisible()
  await editor.page.keyboard.press('Escape')
})

test('Back to Home trims the main menu to what Home can do', async () => {
  await openMainMenu(editor.page)
  await editor.page.getByTestId('app-main-menu-home').click()
  await expect(editor.page.getByTestId('recent-files-home')).toBeVisible()

  const content = await openMainMenu(editor.page)
  const labels = await content.locator(':scope > [role="menuitem"]').allTextContents()
  expect(labels.map((label) => label.replace(/\s+/g, ' ').trim())).toEqual([
    'File',
    'View',
    expect.stringContaining('Settings…'),
    'Help'
  ])
  const file = await openMenuGroup(editor.page, 'File')
  const items = await file.getByRole('menuitem').allTextContents()
  expect(items.some((t) => t.startsWith('Save'))).toBe(false)
})

test('Open storage workspace navigates from the File menu', async () => {
  await runMenuItem(editor.page, 'File', 'Open storage workspace…')

  await expect(editor.page).toHaveURL(/\/$/)
  await expect(editor.page.getByTestId('recent-files-home')).toBeVisible()
  await expect(editor.page.getByRole('heading', { name: 'Storage workspace' })).toBeVisible()
})

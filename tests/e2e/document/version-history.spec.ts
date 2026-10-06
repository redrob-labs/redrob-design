import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

function titleText(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const store = window.redrobDesign?.getStore?.()
    const node = [...(store?.graph.nodes.values() ?? [])].find((n) => n.name === 'Title')
    return node?.type === 'TEXT' ? node.text : null
  })
}

function setTitle(page: Page, text: string): Promise<void> {
  return page.evaluate((next) => {
    const store = window.redrobDesign?.getStore?.()
    if (!store) throw new Error('Editor store is not exposed')
    const node = [...store.graph.nodes.values()].find((n) => n.name === 'Title')
    if (node) store.graph.updateNode(node.id, { text: next })
    else store.graph.createNode('TEXT', store.state.currentPageId, { name: 'Title', text: next })
    store.requestRender()
  }, text)
}

test('Version history saves a named version and restores it as one undo step', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  await setTitle(page, 'First draft')

  await page.evaluate(async () => {
    const service = await import('/src/app/document/history/service.ts' as string)
    service.openVersionHistory()
  })
  const history = page.getByTestId('version-history')
  await expect(history).toContainText('On this computer only.')
  await history.getByLabel('Version name').fill('Before the rewrite')
  await history.getByRole('button', { name: 'Save version' }).click()
  const row = history.locator('[data-slot="history-version"]', { hasText: 'Before the rewrite' })
  await expect(row).toBeVisible()
  await expect(row.getByRole('img', { name: 'Preview of Before the rewrite' })).toBeVisible()

  await setTitle(page, 'Rewritten')
  await row.getByRole('button', { name: 'Restore' }).click()
  await expect(history).toBeHidden()
  await expect.poll(() => titleText(page)).toBe('First draft')

  await page.evaluate(() => window.redrobDesign?.getStore?.()?.undoAction())
  await expect.poll(() => titleText(page)).toBe('Rewritten')

  // The changes the restore replaced were kept as a version of their own.
  await page.evaluate(async () => {
    const service = await import('/src/app/document/history/service.ts' as string)
    service.openVersionHistory()
  })
  await expect(
    history.locator('[data-slot="history-version"][data-kind="auto"]').first()
  ).toBeVisible()
})

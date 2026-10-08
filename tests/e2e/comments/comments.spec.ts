import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

test('comments are placed, answered and resolved in Describe, on this computer', async ({
  page
}) => {
  test.setTimeout(60_000)
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await page.evaluate(() => {
    const store = window.redrobDesign?.getStore?.()
    if (!store) throw new Error('Editor store is not exposed')
    store.graph.createNode('FRAME', store.state.currentPageId, {
      name: 'Hero',
      x: 100,
      y: 100,
      width: 300,
      height: 200,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, visible: true, opacity: 1 }]
    })
    store.requestRender()
  })
  await page.getByTestId('mode-switch').getByRole('button', { name: 'Describe' }).click()

  await page.evaluate(async () => {
    const service = await import('/src/app/comments/service.ts' as string)
    service.openComments()
  })
  const panel = page.getByTestId('comments-panel')
  await expect(panel).toContainText('Not shared.')
  await expect(panel).toContainText('No comments yet.')
  await panel.getByRole('button', { name: 'Add comment' }).click()
  await expect(page.getByTestId('comment-placing')).toBeVisible()
  await expect(panel).toBeHidden()

  const box = await page.getByTestId('canvas-element').boundingBox()
  if (!box) throw new Error('Canvas has no bounding box')
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  const thread = page.getByTestId('comment-thread')
  await thread.getByPlaceholder('Add a comment').fill('Tighten the hero copy')
  await thread.getByRole('button', { name: 'Post' }).click()
  await expect(page.getByTestId('comment-placing')).toBeHidden()
  await expect(thread.locator('[data-slot="comment"]')).toHaveText([/Tighten the hero copy/])

  await thread.getByPlaceholder('Reply').fill('On it')
  await thread.getByRole('button', { name: 'Reply' }).click()
  await expect(thread.locator('[data-slot="comment"]')).toHaveCount(2)
  await thread.getByRole('button', { name: 'Resolve' }).click()
  await expect(thread.getByRole('button', { name: 'Reopen' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(thread).toBeHidden()

  const pins = await page.evaluate(() => window.redrobDesign?.getStore?.()?.state.commentPins ?? [])
  // A resolved thread's pin is hidden until the comments list is open.
  expect(pins).toEqual([])
  await page.evaluate(async () => {
    const service = await import('/src/app/comments/service.ts' as string)
    service.openComments()
  })
  const row = panel.locator('[data-slot="comments-thread"]')
  await expect(row).toHaveAttribute('data-resolved', 'true')
  await expect(row).toContainText('1 replies')
})

import { expect, test } from '#tests/helpers/chat/fixture'

test.describe.configure({ timeout: 45_000 })

test('Ship posts the ways out once, and says what is not connected', async ({
  configuredChat: chat
}) => {
  await chat.page.evaluate(() => {
    const store = window.redrobDesign?.getStore?.()
    if (!store) throw new Error('Editor store is not exposed')
    store.graph.createNode('FRAME', store.state.currentPageId, {
      name: 'Pricing',
      width: 400,
      height: 300,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    store.requestRender()
  })
  await chat.page.getByTestId('mode-switch').getByRole('button', { name: 'Describe' }).click()
  await chat.page.getByTestId('describe-ship').click()

  const ways = chat.assistantMessage().getByRole('group', { name: 'Ways to ship' })
  await expect(ways).toBeVisible()
  await expect(ways.getByRole('button', { name: 'React + tokens' })).toBeVisible()
  await expect(chat.assistantMessage()).toContainText('Once a workspace is connected')

  await ways.getByRole('button', { name: 'Publish' }).click()
  await expect(
    chat.page.getByTestId('toast-item').filter({ hasText: 'none is connected yet' })
  ).toBeVisible()

  await chat.page.getByTestId('describe-ship').click()
  await expect(
    chat.page.getByTestId('toast-item').filter({ hasText: 'already open' })
  ).toBeVisible()
  await expect(chat.page.locator('[data-slot="ship-card"]')).toHaveCount(1)
})

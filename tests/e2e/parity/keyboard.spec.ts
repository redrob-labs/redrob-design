import { expect, test } from '#tests/helpers/chat/fixture'

/**
 * Keyboard acceptance for the new surfaces: everything reachable and
 * operable without a pointer, per the design-system accessibility rule.
 */
test.describe.configure({ timeout: 45_000 })

test('the mode switch works from the keyboard', async ({ configuredChat: chat }) => {
  const describeButton = chat.page
    .getByTestId('mode-switch')
    .getByRole('button', { name: 'Describe' })
  await describeButton.focus()
  await chat.page.keyboard.press('Enter')
  await expect(chat.page.getByTestId('describe-workspace')).toBeVisible()

  const editButton = chat.page.getByTestId('mode-switch').getByRole('button', { name: 'Edit' })
  await editButton.focus()
  await chat.page.keyboard.press('Space')
  await expect(chat.page.getByTestId('layers-panel')).toBeVisible()
})

test('the thread edge moves with the arrow keys', async ({ configuredChat: chat }) => {
  await chat.page.getByTestId('mode-switch').getByRole('button', { name: 'Describe' }).click()
  const edge = chat.page.getByRole('separator', { name: 'Resize the Redrob panel' })
  await edge.focus()
  await chat.page.keyboard.press('ArrowLeft')
  await expect(edge).toHaveAttribute('aria-valuenow', '456')
  await chat.page.keyboard.press('ArrowRight')
  await chat.page.keyboard.press('ArrowRight')
  await expect(edge).toHaveAttribute('aria-valuenow', '424')
})

test('tool keys stand down in Describe and work again in Edit', async ({
  configuredChat: chat
}) => {
  const tool = () => chat.page.evaluate(() => window.redrobDesign?.getStore?.().state.activeTool)
  await chat.page.getByTestId('mode-switch').getByRole('button', { name: 'Describe' }).click()
  await chat.page.getByTestId('canvas-element').click({ position: { x: 30, y: 30 } })
  await chat.page.keyboard.press('KeyF')
  expect(await tool()).toBe('SELECT')

  await chat.page.getByTestId('mode-switch').getByRole('button', { name: 'Edit' }).click()
  await chat.page.getByTestId('canvas-element').click({ position: { x: 30, y: 30 } })
  await chat.page.keyboard.press('KeyF')
  expect(await tool()).toBe('FRAME')
})

test('Escape closes the Design Memory drawer and Undo works in Describe', async ({
  configuredChat: chat
}) => {
  await chat.page.getByTestId('mode-switch').getByRole('button', { name: 'Describe' }).click()
  await chat.submit('Show plan questions')
  await chat
    .assistantMessage()
    .getByRole('button', { name: /Design Memory/ })
    .focus()
  await chat.page.keyboard.press('Enter')
  const drawer = chat.page.getByTestId('design-memory-drawer')
  await expect(drawer).toBeVisible()
  await chat.page.keyboard.press('Escape')
  await expect(drawer).toBeHidden()

  const id = await chat.page.evaluate(() => {
    const store = window.redrobDesign?.getStore?.()
    const turn = window.redrobDesign?.test?.changeTurn
    if (!store || !turn) throw new Error('hooks missing')
    turn.begin()
    const node = store.graph.createNode('RECTANGLE', store.state.currentPageId, { name: 'Badge' })
    turn.finish('turn-under-test')
    return node.id
  })
  // Undo belongs to the page, not to a text field the drawer handed focus back to.
  await chat.page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  })
  await chat.page.keyboard.press('ControlOrMeta+z')
  await expect
    .poll(() =>
      chat.page.evaluate(
        (nodeId) => Boolean(window.redrobDesign?.getStore?.().graph.getNode(nodeId)),
        id
      )
    )
    .toBe(false)
})

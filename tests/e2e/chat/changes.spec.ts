import type { Page } from '@playwright/test'

import { expect, test } from '#tests/helpers/chat/fixture'

/**
 * The mock transport streams answers without running tools, so the test
 * plays the part of the tool loop: it opens a turn, edits the page and
 * closes the turn for the answer the mock just gave (`mock-msg-1`).
 */
async function answerAddsBadge(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const modulePath = '/src/app/assistant/changes/store.ts'
    const changes = await import(modulePath)
    const store = window.redrobDesign?.getStore?.()
    if (!store) throw new Error('Editor store is not exposed')
    changes.beginChangeTurn(store)
    const node = store.graph.createNode('RECTANGLE', store.state.currentPageId, { name: 'Badge' })
    changes.finishChangeTurn(store, 'mock-msg-1')
    return node.id
  })
}

async function nodeExists(page: Page, id: string): Promise<boolean> {
  return page.evaluate(
    (nodeId) => Boolean(window.redrobDesign?.getStore?.().graph.getNode(nodeId)),
    id
  )
}

test('an answer that changed the page asks to Keep it or Put it back', async ({
  configuredChat: chat
}) => {
  test.setTimeout(45_000)
  await chat.submit('Hello there')
  await expect(chat.assistantMessage()).toContainText('mock response')
  const id = await answerAddsBadge(chat.page)

  const card = chat
    .assistantMessage()
    .getByRole('group', { name: 'Changes on this page: 1 change' })
  await expect(card).toBeVisible()
  await expect(card).toContainText('Badge')
  await expect(
    chat.page.getByTestId('properties-tab-ai').locator('[data-slot="changes-waiting"]')
  ).toHaveText('1')

  await card.getByRole('button', { name: 'Put it back' }).click()
  await expect(chat.assistantMessage()).toContainText('put back. Nothing changed.')
  expect(await nodeExists(chat.page, id)).toBe(false)
  await expect(chat.page.locator('[data-slot="changes-waiting"]')).toHaveCount(0)
})

test('the latest kept change offers Undo', async ({ configuredChat: chat }) => {
  test.setTimeout(45_000)
  await chat.submit('Hello there')
  await expect(chat.assistantMessage()).toContainText('mock response')
  const id = await answerAddsBadge(chat.page)

  await chat.assistantMessage().getByRole('button', { name: 'Keep it' }).click()
  await expect(chat.assistantMessage()).toContainText('Changes on this page: kept.')
  expect(await nodeExists(chat.page, id)).toBe(true)

  await chat.assistantMessage().getByRole('button', { name: 'Undo' }).click()
  await expect(chat.assistantMessage()).toContainText('Changes on this page: undone.')
  expect(await nodeExists(chat.page, id)).toBe(false)
})

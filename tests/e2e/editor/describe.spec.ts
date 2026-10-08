import type { Page } from '@playwright/test'

import type { Vector } from '@redrob-design/scene-graph/primitives'

import { expect, test } from '#tests/helpers/chat/fixture'

test.describe.configure({ timeout: 45_000 })

function modeSwitch(page: Page) {
  return page.getByTestId('mode-switch')
}

async function enterDescribe(page: Page) {
  await modeSwitch(page).getByRole('button', { name: 'Describe' }).click()
  await expect(page.getByTestId('describe-workspace')).toBeVisible()
}

/** Adds a card and returns where its center is on the canvas element, in pixels. */
async function addCard(page: Page): Promise<Vector> {
  return page.evaluate(() => {
    const store = window.redrobDesign?.getStore?.()
    if (!store) throw new Error('Editor store is not exposed')
    store.graph.createNode('FRAME', store.state.currentPageId, {
      name: 'Pricing card',
      x: 0,
      y: 0,
      width: 400,
      height: 300,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    store.requestRender()
    const { panX, panY, zoom } = store.state
    return { x: 200 * zoom + panX, y: 150 * zoom + panY }
  })
}

test('a brief from Home opens in Describe', async ({ configuredChat: chat }) => {
  await chat.page.getByTestId('tabbar-new').click()
  const field = chat.page.getByTestId('home-brief').getByRole('textbox', { name: 'Your brief' })
  await field.fill('A pricing page')
  await field.press('Enter')

  await expect(chat.page.getByTestId('describe-workspace')).toBeVisible()
  await expect(modeSwitch(chat.page).getByRole('button', { name: 'Describe' })).toHaveAttribute(
    'data-state',
    'on'
  )
  await expect(chat.userMessage()).toContainText('A pricing page')
  await expect(chat.page.getByTestId('layers-panel')).toHaveCount(0)
})

test('Describe is view-only and Edit brings the panels back', async ({ configuredChat: chat }) => {
  await enterDescribe(chat.page)
  await chat.page.getByTestId('canvas-element').click({ position: { x: 40, y: 40 } })
  await chat.page.keyboard.press('KeyR')
  expect(await chat.page.evaluate(() => window.redrobDesign?.getStore?.().state.activeTool)).toBe(
    'SELECT'
  )

  await modeSwitch(chat.page).getByRole('button', { name: 'Edit' }).click()
  await expect(chat.page.getByTestId('describe-workspace')).toHaveCount(0)
  await expect(chat.page.getByTestId('properties-panel')).toBeVisible()
  expect(await chat.page.evaluate(() => window.redrobDesign?.getStore?.().state.viewOnly)).toBe(
    false
  )
})

test('pointing at the canvas adds that layer to the composer', async ({ configuredChat: chat }) => {
  await enterDescribe(chat.page)
  const center = await addCard(chat.page)
  await chat.page.getByTestId('canvas-element').click({ position: center })

  await expect(chat.page.getByTestId('chat-composer')).toContainText('Pricing card')
  expect(
    await chat.page.evaluate(() => window.redrobDesign?.getStore?.().state.selectedIds.size)
  ).toBe(0)
})

test('the thread resizes between 340 and 720 pixels', async ({ configuredChat: chat }) => {
  await enterDescribe(chat.page)
  const thread = chat.page.getByTestId('describe-thread')
  const resizer = chat.page.getByRole('separator', { name: 'Resize the Redrob panel' })
  await expect(resizer).toHaveAttribute('aria-valuenow', '440')

  await resizer.focus()
  await chat.page.keyboard.press('Home')
  await expect(resizer).toHaveAttribute('aria-valuenow', '720')
  await chat.page.keyboard.press('End')
  await expect(resizer).toHaveAttribute('aria-valuenow', '340')
  expect((await thread.boundingBox())?.width).toBeCloseTo(340, 0)
})

test('opening Describe checks the page for free and Fix all settles it', async ({
  configuredChat: chat
}) => {
  const cardId = await chat.page.evaluate(() => {
    const store = window.redrobDesign?.getStore?.()
    if (!store) throw new Error('Editor store is not exposed')
    const card = store.graph.createNode('FRAME', store.state.currentPageId, {
      name: 'Plans',
      layoutMode: 'VERTICAL',
      itemSpacing: 13,
      width: 320,
      height: 200,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    store.requestRender()
    return card.id
  })
  await enterDescribe(chat.page)

  const findings = chat.assistantMessage().getByRole('region', { name: 'Findings' })
  await expect(chat.assistantMessage()).toContainText('on this computer, free')
  await expect(findings.getByRole('article', { name: 'Spacing is off the 4px grid' })).toBeVisible()

  await findings.getByRole('button', { name: /^Fix all/ }).click()
  // Fixed findings leave the list; ones with no sure fix stay for a person.
  await expect(findings.getByRole('article', { name: 'Spacing is off the 4px grid' })).toHaveCount(
    0
  )
  expect(
    await chat.page.evaluate(
      (id) => window.redrobDesign?.getStore?.().graph.getNode(id)?.itemSpacing,
      cardId
    )
  ).toBe(12)
})

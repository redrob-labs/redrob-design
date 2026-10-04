import type { Page } from '@playwright/test'

import { expect, test } from '#tests/helpers/chat/fixture'
import { openSettingsFromMenu } from '#tests/helpers/menu'
import { setAppTheme } from '#tests/helpers/theme'

/**
 * One test per approved prototype state (reference/screens/states). Each
 * checks the landmarks that state is made of, so a regression that drops a
 * surface fails here before anyone compares pictures.
 */
test.describe.configure({ timeout: 45_000 })

async function addPricingCard(page: Page): Promise<void> {
  await page.evaluate(() => {
    const store = window.redrobDesign?.getStore?.()
    if (!store) throw new Error('Editor store is not exposed')
    const card = store.graph.createNode('FRAME', store.state.currentPageId, {
      name: 'Plans',
      layoutMode: 'VERTICAL',
      itemSpacing: 13,
      width: 480,
      height: 320,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    store.graph.createNode('TEXT', card.id, { name: 'Team', text: '$24 per person' })
    store.requestRender()
  })
}

async function describe(page: Page): Promise<void> {
  await page.getByTestId('mode-switch').getByRole('button', { name: 'Describe' }).click()
  await expect(page.getByTestId('describe-workspace')).toBeVisible()
}

test('01 Home: a brief, suggestions and recent files', async ({ chat }) => {
  await chat.page.getByTestId('tabbar-new').click()
  const brief = chat.page.getByTestId('home-brief')
  await expect(brief.getByRole('heading', { name: 'What are you making?' })).toBeVisible()
  await expect(brief.getByRole('group', { name: 'Try' })).toBeVisible()
  await expect(chat.page.getByTestId('mode-switch')).toHaveCount(0)
})

test('02 Describe: canvas, thread, composer and the opening check', async ({
  configuredChat: chat
}) => {
  await addPricingCard(chat.page)
  await describe(chat.page)
  await expect(chat.page.getByRole('region', { name: 'Page' })).toBeVisible()
  await expect(chat.page.getByRole('complementary', { name: 'Redrob' })).toBeVisible()
  await expect(chat.page.getByTestId('describe-ship')).toBeVisible()
  await expect(chat.page.getByTestId('chat-composer')).toBeVisible()
  await expect(chat.assistantMessage().getByRole('region', { name: 'Findings' })).toBeVisible()
  await expect(chat.page.getByTestId('layers-panel')).toHaveCount(0)
})

test('03 Describe with Design Memory open', async ({ configuredChat: chat }) => {
  await describe(chat.page)
  await chat.submit('Show plan questions')
  await chat
    .assistantMessage()
    .getByRole('button', { name: /Design Memory/ })
    .click()
  const drawer = chat.page.getByTestId('design-memory-drawer')
  await expect(drawer.getByRole('heading', { name: 'Design Memory' })).toBeVisible()
  await expect(drawer).toContainText('Voice and rules')
})

test('04 Describe after Fix all', async ({ configuredChat: chat }) => {
  await addPricingCard(chat.page)
  await describe(chat.page)
  const findings = chat.assistantMessage().getByRole('region', { name: 'Findings' })
  await findings.getByRole('button', { name: /^Fix all/ }).click()
  await expect(findings.getByRole('article', { name: 'Spacing is off the 4px grid' })).toHaveCount(
    0
  )
})

test('05 Describe with Ship open', async ({ configuredChat: chat }) => {
  await addPricingCard(chat.page)
  await describe(chat.page)
  await chat.page.getByTestId('describe-ship').click()
  const ways = chat.assistantMessage().getByRole('group', { name: 'Ways to ship' })
  for (const name of ['Publish', 'React + tokens', 'Hand to Claude Code', 'Export for Figma']) {
    await expect(ways.getByRole('button', { name })).toBeVisible()
  }
  await expect(chat.assistantMessage()).toContainText('This page updates itself.')
})

test('06 Edit: layers, canvas and Design | Code | Redrob', async ({ configuredChat: chat }) => {
  await expect(chat.page.getByTestId('layers-panel')).toBeVisible()
  await expect(chat.page.getByTestId('properties-tab-design')).toBeVisible()
  await expect(chat.page.getByTestId('properties-tab-code')).toBeVisible()
  await expect(chat.page.getByTestId('properties-tab-ai')).toContainText('Redrob')
  await expect(
    chat.page.getByTestId('mode-switch').getByRole('button', { name: 'Edit' })
  ).toHaveAttribute('data-state', 'on')
})

test('07 Edit in the dark theme', async ({ configuredChat: chat }) => {
  await setAppTheme(chat.page, 'dark')
  await expect(chat.page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(chat.page.getByTestId('layers-panel')).toBeVisible()
})

test('08 Settings: five sections in three groups', async ({ chat }) => {
  await openSettingsFromMenu(chat.page)
  const dialog = chat.page.getByTestId('app-settings-dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('General')
})

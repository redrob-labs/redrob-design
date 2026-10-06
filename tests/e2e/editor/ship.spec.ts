import type { Page } from '@playwright/test'

import { expect, test } from '#tests/helpers/chat/fixture'

test.describe.configure({ timeout: 60_000 })

async function shipPricingPage(page: Page): Promise<void> {
  await page.evaluate(() => {
    const store = window.redrobDesign?.getStore?.()
    if (!store) throw new Error('Editor store is not exposed')
    store.graph.updateNode(store.state.currentPageId, { name: 'Pricing' })
    store.graph.createNode('FRAME', store.state.currentPageId, {
      name: 'Pricing',
      width: 400,
      height: 300,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    store.requestRender()
  })
  await page.getByTestId('mode-switch').getByRole('button', { name: 'Describe' }).click()
  await page.getByTestId('describe-ship').click()
}

test('Ship posts the ways out once, and Publish says what it needs', async ({
  configuredChat: chat
}) => {
  await shipPricingPage(chat.page)

  const ways = chat.assistantMessage().getByRole('group', { name: 'Ways to ship' })
  await expect(ways).toBeVisible()
  await expect(ways.getByRole('button', { name: 'React + tokens' })).toBeVisible()
  await expect(chat.assistantMessage()).toContainText('Once a workspace is connected')

  await ways.getByRole('button', { name: 'Publish' }).click()
  const confirm = chat.page.getByRole('alertdialog')
  await expect(confirm).toContainText('Anyone with the address can see it.')
  await confirm.getByRole('button', { name: 'Publish' }).click()
  await expect(
    chat.page.getByTestId('toast-item').filter({ hasText: 'needs a publish bucket' })
  ).toBeVisible()
  await expect(chat.page.getByTestId('settings-publish-site')).toBeVisible()
  await chat.page.getByTestId('app-settings-done').click()

  await chat.page.getByTestId('describe-ship').click()
  await expect(
    chat.page.getByTestId('toast-item').filter({ hasText: 'already open' })
  ).toBeVisible()
  await expect(chat.page.locator('[data-slot="ship-card"]')).toHaveCount(1)
})

test('Publish uploads the page to the publish bucket and Unpublish takes it down', async ({
  configuredChat: chat
}) => {
  const { page } = chat
  const objects = new Map<string, string>()
  const writes: string[] = []
  await page.route('https://s3.example.com/**', async (route) => {
    const request = route.request()
    const key = new URL(request.url()).pathname
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': '*'
    }
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    if (request.method() === 'PUT') {
      writes.push(`put ${key}`)
      objects.set(key, request.postData() ?? '')
      return route.fulfill({ status: 200, headers: cors })
    }
    if (request.method() === 'DELETE') {
      writes.push(`delete ${key}`)
      objects.delete(key)
      return route.fulfill({ status: 204, headers: cors })
    }
    const body = objects.get(key)
    return body === undefined
      ? route.fulfill({ status: 404, headers: cors })
      : route.fulfill({ status: 200, headers: cors, body })
  })
  await page.route('https://site.example.com/**', (route) =>
    route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*' } })
  )

  await page.evaluate(async () => {
    const path = '/src/app/settings/dialog.ts'
    const settings = await import(path)
    settings.openSettingsDialog('storage')
  })
  const publishSite = page.getByTestId('settings-publish-site')
  await publishSite.getByLabel('Endpoint').fill('https://s3.example.com')
  await publishSite.getByLabel('Endpoint').blur()
  await publishSite.getByLabel('Bucket').fill('site')
  await publishSite.getByLabel('Bucket').blur()
  for (const [field, value] of [
    ['access-key-id', 'access-key'],
    ['secret-access-key', 'secret-key']
  ] as const) {
    const container = publishSite.locator(`[data-credential="${field}"]`)
    await container.locator('input').fill(value)
    await container.getByRole('button', { name: 'Save' }).click()
  }
  await publishSite.getByLabel('Public site URL').fill('https://site.example.com')
  await publishSite.getByLabel('Public site URL').blur()
  await page.getByTestId('app-settings-done').click()

  await shipPricingPage(page)
  const ways = chat.assistantMessage().getByRole('group', { name: 'Ways to ship' })
  await ways.getByRole('button', { name: 'Publish' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Publish' }).click()
  await expect(
    page
      .getByTestId('toast-item')
      .filter({ hasText: 'Published to https://site.example.com/pricing/' })
  ).toBeVisible()

  const puts = writes.filter((entry) => entry.startsWith('put /site/sites/pricing/'))
  expect(puts.at(-1)).toBe('put /site/sites/pricing/index.html')
  expect(puts.at(-2)).toBe('put /site/sites/pricing/publish.json')
  expect(objects.get('/site/sites/pricing/index.html')).toContain('<main')

  await ways.getByRole('button', { name: 'Unpublish' }).click()
  await expect(
    page.getByTestId('toast-item').filter({ hasText: 'no longer published' })
  ).toBeVisible()
  expect([...objects.keys()].filter((key) => key.startsWith('/site/sites/pricing/'))).toEqual([])
})

test('Hand to Claude Code downloads the page, tokens and brief as one zip', async ({
  configuredChat: chat
}) => {
  await shipPricingPage(chat.page)
  const ways = chat.assistantMessage().getByRole('group', { name: 'Ways to ship' })
  const download = chat.page.waitForEvent('download')
  await ways.getByRole('button', { name: 'Hand to Claude Code' }).click()
  expect((await download).suggestedFilename()).toBe('redrob-handoff-pricing.zip')
  await expect(
    chat.page
      .getByTestId('toast-item')
      .filter({ hasText: 'Unzip it at the root of your repository' })
  ).toBeVisible()
})

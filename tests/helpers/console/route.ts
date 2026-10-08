import type { Page } from '@playwright/test'

import { BLOB_ORIGIN, answerBlob } from './design'
import { createMockConsole, mockConsoleFetch, type MockConsole } from './server'

/**
 * Answers every call the app makes to Redrob Console from the in-memory mock, and the presigned
 * storage links it hands out from the mock's blob store. Pages given the same mock share one
 * Console, as two people on one deployment would.
 */
export async function routeConsoleToMock(
  page: Page,
  mock: MockConsole = createMockConsole()
): Promise<MockConsole> {
  const answer = mockConsoleFetch(mock)
  await page.unroute('https://console.redrob.ai/**')
  await page.route('https://console.redrob.ai/api/backend/v1/**', async (route) => {
    const request = route.request()
    const response = await answer(request.url(), {
      method: request.method(),
      headers: request.headers(),
      body: request.postData() ?? undefined
    })
    await route.fulfill({
      status: response.status,
      headers: { ...Object.fromEntries(response.headers), 'access-control-allow-origin': '*' },
      body: await response.text()
    })
  })
  await page.route(`${BLOB_ORIGIN}/**`, async (route) => {
    const request = route.request()
    const bytes = request.postDataBuffer()
    const response = await answerBlob(mock.state.design, new URL(request.url()), {
      method: request.method(),
      body: bytes ? new Blob([new Uint8Array(bytes)]) : undefined
    })
    await route.fulfill({
      status: response.status,
      headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
      body: Buffer.from(await response.arrayBuffer())
    })
  })
  return mock
}

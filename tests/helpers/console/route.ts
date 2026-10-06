import type { Page } from '@playwright/test'

import { createMockConsole, mockConsoleFetch, type MockConsole } from './server'

/** Answers every call the app makes to Redrob Console from the in-memory mock. */
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
  return mock
}

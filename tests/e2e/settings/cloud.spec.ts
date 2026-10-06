import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { MOCK_USER_CODE, createMockConsole, mockConsoleFetch } from '#tests/helpers/console/server'
import { openSettingsFromMenu } from '#tests/helpers/menu'

test('Redrob Cloud signs in with a Console code, picks a workspace and signs out', async ({
  page
}) => {
  test.setTimeout(60_000)
  const mock = createMockConsole()
  mock.state.pendingPolls = 2
  const answer = mockConsoleFetch(mock)
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

  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  await openSettingsFromMenu(page)
  await page.getByTestId('settings-section-cloud').click()
  const panel = page.getByTestId('settings-cloud-panel')
  await expect(panel).toContainText('Not signed in')

  await panel.getByRole('button', { name: 'Sign in with Redrob Console' }).click()
  await expect(panel.locator('[data-slot="cloud-user-code"]')).toHaveText(MOCK_USER_CODE)
  await expect(panel.locator('[data-slot="cloud-account"]')).toHaveText(
    'Signed in as Jane Designer.',
    { timeout: 20_000 }
  )

  const workspace = panel.getByRole('combobox', { name: 'Workspace' })
  await expect(workspace).toHaveValue('ws-1')
  await workspace.selectOption('ws-2')
  await expect(workspace).toHaveValue('ws-2')
  expect(mock.state.requests.find((request) => request.path === '/me')?.authorized).toBe(true)

  await panel.getByRole('button', { name: 'Sign out' }).click()
  await expect(panel).toContainText('Not signed in')
})

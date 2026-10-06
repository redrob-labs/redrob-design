import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { routeConsoleToMock } from '#tests/helpers/console/route'
import { MOCK_USER_CODE, createMockConsole } from '#tests/helpers/console/server'
import { openSettingsFromMenu } from '#tests/helpers/menu'

test('Redrob Cloud signs in with a Console code, picks a workspace and signs out', async ({
  page
}) => {
  test.setTimeout(60_000)
  const mock = createMockConsole()
  mock.state.pendingPolls = 2
  await routeConsoleToMock(page, mock)

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

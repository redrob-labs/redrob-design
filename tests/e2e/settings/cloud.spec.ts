import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { routeConsoleToMock } from '#tests/helpers/console/route'
import { MOCK_USER_CODE, createMockConsole } from '#tests/helpers/console/server'
import { openSettingsFromMenu } from '#tests/helpers/menu'

async function signIn(page: Page) {
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
  return { mock, panel }
}

test('Redrob Cloud signs in with a Console code, picks a workspace and signs out', async ({
  page
}) => {
  test.setTimeout(60_000)
  const { mock, panel } = await signIn(page)
  const workspace = panel.getByRole('combobox', { name: 'Workspace' })
  await expect(workspace).toHaveValue('ws-1')
  await workspace.selectOption('ws-2')
  await expect(workspace).toHaveValue('ws-2')
  expect(mock.state.requests.find((request) => request.path === '/design/me')?.authorized).toBe(
    true
  )

  await panel.getByRole('button', { name: 'Sign out' }).click()
  await expect(panel).toContainText('Not signed in')
})

test('a signed-in workspace becomes Design Memory and its admin sets Privacy', async ({ page }) => {
  test.setTimeout(60_000)
  const { mock } = await signIn(page)
  await expect
    .poll(() => mock.state.requests.some((request) => request.path === '/workspaces/ws-1/memory'))
    .toBe(true)
  const memory = await page.evaluate(async () => {
    const service = await import('/src/app/memory/service.ts' as string)
    const privacy = await import('/src/app/assistant/privacy/store.ts' as string)
    const store = window.redrobDesign?.getStore?.()
    if (!store) throw new Error('store not exposed')
    const read = service.designMemorySource().read(store.graph, 'Untitled')
    return {
      owner: read.owner,
      workspace: service.designMemorySource().workspace(),
      level: privacy.privacyLevel.value,
      locked: privacy.privacyLevelLocked.value
    }
  })
  expect(memory).toEqual({
    owner: 'Redrob Office',
    workspace: {
      connected: true,
      name: 'Redrob Office',
      sources: ['redrob.io', 'Pricing sheet, Q4']
    },
    level: 'strict',
    locked: true
  })
})

import { expect, test, type Locator } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { ChatHarness } from '#tests/helpers/chat/harness'
import { injectMockChatTransport } from '#tests/helpers/chat/transport'
import { routeConsoleToMock } from '#tests/helpers/console/route'
import { openSweepApp } from '#tests/helpers/ui/sweep'

/**
 * A field whose wrapper draws the focus ring shows focus once: the wrapper's
 * ring, not a second outline on the input inside it.
 */
async function expectOneRing(wrapper: Locator, field: Locator): Promise<void> {
  await field.focus()
  await expect(field).toBeFocused()
  await expect(field).toHaveCSS('outline-style', 'none')
  await expect(wrapper).not.toHaveCSS('box-shadow', 'none')
}

test('Home search shows one focus ring', async ({ page }) => {
  await openSweepApp(page)
  await page.getByTestId('tabbar-new').click()
  const home = page.getByTestId('recent-files-home')
  const field = home.getByRole('searchbox').first()
  await expectOneRing(home.locator('label[data-focus-ring="within"]').first(), field)
})

test('the Describe composer shows one focus ring', async ({ page }) => {
  await routeConsoleToMock(page)
  const chat = new ChatHarness(page)
  await chat.open()
  await new CanvasHelper(page).waitForInit()
  await injectMockChatTransport(page)
  await chat.configureOpenRouter('sk-or-test-key-12345')
  await page.getByTestId('mode-switch').getByRole('button', { name: 'Describe' }).click()
  const composer = page.getByTestId('chat-composer')
  await expectOneRing(
    composer.locator('[data-slot="composer-box"]'),
    composer.locator('[data-slot="composer-input"]')
  )
})

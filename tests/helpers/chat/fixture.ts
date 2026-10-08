import { test as base, expect } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { ChatHarness } from '#tests/helpers/chat/harness'
import { injectMockChatTransport } from '#tests/helpers/chat/transport'

interface ChatFixtures {
  chat: ChatHarness
  configuredChat: ChatHarness
}

export const test = base.extend<ChatFixtures>({
  chat: async ({ page }, use) => {
    // Tests never reach the real Console; feeds fall back to the fixture
    // unless a test routes Console to the mock first.
    await page.route('https://console.redrob.ai/**', (route) => route.abort())
    const harness = new ChatHarness(page)
    await harness.open()
    const canvas = new CanvasHelper(page)
    await canvas.waitForInit()
    await injectMockChatTransport(page)
    await use(harness)
  },
  configuredChat: async ({ chat }, use) => {
    await chat.configureOpenRouter('sk-or-test-key-12345')
    await use(chat)
  }
})

export { expect }

import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { ChatHarness } from '#tests/helpers/chat/harness'
import { injectMockChatTransport } from '#tests/helpers/chat/transport'
import { routeConsoleToMock } from '#tests/helpers/console/route'
import {
  SWEEP_THEMES,
  auditSurface,
  closesWithEscape,
  openSweepApp,
  useTheme,
  watchConsole,
  type ConsoleWatch,
  type SweepIssue
} from '#tests/helpers/ui/sweep'

/**
 * Describe and the Redrob thread: the workspace with an answer and its
 * Changes card, the composer pickers, Ship and its publish confirmation,
 * Design Memory, toasts and the `/demo` route, in both themes.
 */
test.describe.configure({ timeout: 150_000 })

/** The app with a configured mock model, Console on the mock and a frame on the page. */
async function openDescribe(page: Page): Promise<{ chat: ChatHarness; errors: ConsoleWatch }> {
  await routeConsoleToMock(page)
  const errors = watchConsole(page)
  const chat = new ChatHarness(page)
  await chat.open()
  await new CanvasHelper(page).waitForInit()
  await injectMockChatTransport(page)
  await chat.configureOpenRouter('sk-or-test-key-12345')
  await page.evaluate(() => {
    const store = window.redrobDesign?.getStore?.()
    if (!store) throw new Error('Editor store is not exposed')
    store.graph.createNode('FRAME', store.state.currentPageId, {
      name: 'Pricing',
      width: 400,
      height: 300,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    store.requestRender()
  })
  await page.getByTestId('mode-switch').getByRole('button', { name: 'Describe' }).click()
  await expect(page.getByTestId('describe-workspace')).toBeVisible()
  errors.take()
  return { chat, errors }
}

/** The answer adds a layer, as the tool loop would, so the Changes card shows. */
async function answerAddsBadge(page: Page): Promise<void> {
  await page.evaluate(() => {
    const store = window.redrobDesign?.getStore?.()
    const turn = window.redrobDesign?.test?.changeTurn
    if (!store || !turn) throw new Error('Editor store or change turn hooks are not exposed')
    turn.begin()
    store.graph.createNode('RECTANGLE', store.state.currentPageId, { name: 'Badge' })
    turn.finish('mock-msg-1')
  })
}

/** The floating content of the popover or menu that opened last. */
function lastPopover(page: Page) {
  return page.locator('[data-reka-popper-content-wrapper]').last()
}

test('Describe with an answer and its Changes card renders cleanly', async ({ page }) => {
  const { chat, errors } = await openDescribe(page)
  await chat.submit('Hello there')
  await expect(chat.assistantMessage()).toContainText('mock response')
  await answerAddsBadge(page)
  await expect(
    chat.assistantMessage().getByRole('group', { name: /^Changes on this page/ })
  ).toBeVisible()
  const issues: SweepIssue[] = []
  for (const theme of SWEEP_THEMES) {
    await useTheme(page, theme)
    const workspace = page.getByTestId('describe-workspace')
    issues.push(...(await auditSurface(page, workspace, 'describe-answer', theme, errors)))
  }
  expect(issues).toEqual([])
})

test('the composer pickers render cleanly', async ({ page }) => {
  const { errors } = await openDescribe(page)
  const composer = page.getByTestId('chat-composer')
  const status = page.getByRole('group', { name: 'How Redrob treats every message' })
  const issues: SweepIssue[] = []
  for (const theme of SWEEP_THEMES) {
    await useTheme(page, theme)
    await composer.getByRole('button', { name: 'Model', exact: true }).click()
    const picker = lastPopover(page)
    issues.push(...(await auditSurface(page, picker, 'composer-model', theme, errors)))
    issues.push(...(await closesWithEscape(page, picker, 'composer-model')))
    for (const [name, label] of [
      ['composer-privacy', /^Privacy:/],
      ['composer-memory', /^Memory:/],
      ['composer-cross-check', /^Cross-check:/]
    ] as const) {
      await status.getByRole('button', { name: label }).click()
      const popover = lastPopover(page)
      issues.push(...(await auditSurface(page, popover, name, theme, errors)))
      issues.push(...(await closesWithEscape(page, popover, name)))
    }
  }
  expect(issues).toEqual([])
})

test('Ship and its publish confirmation render cleanly', async ({ page }) => {
  const { chat, errors } = await openDescribe(page)
  await page.getByTestId('describe-ship').click()
  const card = chat.assistantMessage().locator('[data-slot="ship-card"]')
  await expect(card).toBeVisible()
  const issues: SweepIssue[] = []
  for (const theme of SWEEP_THEMES) {
    await useTheme(page, theme)
    issues.push(...(await auditSurface(page, card, 'ship-card', theme, errors)))
    await card.getByRole('button', { name: 'Publish' }).click()
    const confirm = page.getByRole('alertdialog')
    issues.push(...(await auditSurface(page, confirm, 'ship-publish-confirm', theme, errors)))
    issues.push(...(await closesWithEscape(page, confirm, 'ship-publish-confirm')))
  }
  expect(issues).toEqual([])
})

test('Design Memory and a toast render cleanly', async ({ page }) => {
  const { errors } = await openDescribe(page)
  const issues: SweepIssue[] = []
  for (const theme of SWEEP_THEMES) {
    await useTheme(page, theme)
    await page.evaluate(async () => {
      const service = await import('/src/app/memory/service.ts' as string)
      service.openDesignMemory()
    })
    const drawer = page.getByTestId('design-memory-drawer')
    issues.push(...(await auditSurface(page, drawer, 'design-memory', theme, errors)))
    issues.push(...(await closesWithEscape(page, drawer, 'design-memory')))
    await page.evaluate(async () => {
      const ui = await import('/src/app/shell/ui.ts' as string)
      ui.toast.info('Saved the page, tokens.json and the brief to the repository.')
    })
    const toast = page.getByTestId('toast-item').last()
    await expect(toast).toBeVisible()
    issues.push(...(await auditSurface(page, toast, 'toast', theme, errors)))
  }
  expect(issues).toEqual([])
})

test('the demo route renders cleanly', async ({ page }) => {
  const errors = await openSweepApp(page, '/demo')
  const issues: SweepIssue[] = []
  for (const theme of SWEEP_THEMES) {
    await useTheme(page, theme)
    issues.push(...(await auditSurface(page, page.locator('#app'), 'demo', theme, errors)))
  }
  expect(issues).toEqual([])
})

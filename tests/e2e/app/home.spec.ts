import { expect, test } from '#tests/helpers/chat/fixture'
import { setAppTheme } from '#tests/helpers/theme'

test.describe.configure({ timeout: 45_000 })

test('one sentence on Home opens a file with the brief as its first message', async ({
  configuredChat: chat
}) => {
  await chat.page.getByTestId('tabbar-new').click()
  const brief = chat.page.getByTestId('home-brief')
  await expect(brief.getByRole('heading', { name: 'What are you making?' })).toBeVisible()
  await expect(brief.getByRole('group', { name: 'Try' }).getByRole('button')).toHaveCount(3)

  await brief.getByRole('button', { name: 'A pricing page for Redrob Office' }).click()
  const field = brief.getByRole('textbox', { name: 'Your brief' })
  await expect(field).toHaveValue(/^A pricing page for Redrob Office, for startup teams/)
  await expect(brief.getByRole('group', { name: 'Try' })).toBeHidden()

  await field.press('Enter')
  await expect(chat.page.getByTestId('recent-files-home')).toBeHidden()
  // A brief opens in Describe, with the thread docked beside the canvas.
  await expect(chat.page.getByTestId('describe-thread')).toBeVisible()
  await expect(chat.userMessage()).toContainText('A pricing page for Redrob Office')
})

test('New starts a file with a frame of the preset size', async ({ chat }) => {
  await chat.page.getByTestId('tabbar-new').click()
  await chat.page.getByTestId('home-new-presets').click()
  await chat.page.getByRole('menuitem', { name: /^Phone app/ }).click()
  await expect(chat.page.getByTestId('recent-files-home')).toBeHidden()
  await expect
    .poll(() =>
      chat.page.evaluate(() => {
        const store = window.redrobDesign?.getStore?.()
        if (!store) return null
        const frame = store.graph
          .getChildren(store.state.currentPageId)
          .find((node) => node.type === 'FRAME')
        return frame ? `${frame.name} ${frame.width}x${frame.height}` : null
      })
    )
    .toBe('Phone app 402x874')
})

test('the footer says where files are kept', async ({ chat }) => {
  await chat.page.getByTestId('tabbar-new').click()
  const footer = chat.page.getByTestId('home-files-footer')
  await expect(footer).toContainText('Files stay on this computer.')
  await footer.getByRole('button', { name: 'Keep them in your own cloud' }).click()
  await expect(chat.page.getByTestId('settings-section-storage')).toHaveAttribute(
    'data-state',
    'active'
  )
})

test.describe('Home layout', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('matches the approved Home at 1440 x 900', async ({ chat }) => {
    await setAppTheme(chat.page, 'light')
    await chat.page.getByTestId('tabbar-new').click()
    await expect(chat.page.getByTestId('home-brief')).toBeVisible()
    await expect(chat.page.getByTestId('home-brief')).toHaveScreenshot('home-brief-light.png', {
      animations: 'disabled'
    })
  })
})

test.describe('Home on a phone', () => {
  test.use({ viewport: { width: 400, height: 860 } })

  test('stacks without sideways scrolling at 400px', async ({ chat }) => {
    await chat.page.getByTestId('tabbar-new').click()
    const home = chat.page.getByTestId('recent-files-home')
    await expect(chat.page.getByTestId('home-brief')).toBeVisible()
    const widths = await home.evaluate((element) => [element.scrollWidth, element.clientWidth])
    expect(widths[0]).toBe(widths[1])
  })
})

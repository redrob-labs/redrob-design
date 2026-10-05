import { expect, test } from '#tests/helpers/chat/fixture'

test('composer enables submission only for non-empty input', async ({ configuredChat: chat }) => {
  await expect(chat.sendButton).toBeDisabled()
  await chat.input.fill('Make a red rectangle')
  await expect(chat.sendButton).toBeEnabled()
})

test('composer grows with multiline input', async ({ configuredChat: chat }) => {
  await chat.input.fill('First line')
  const initialHeight = (await chat.input.boundingBox())?.height ?? 0
  await chat.input.fill(Array.from({ length: 8 }, (_, index) => `Line ${index + 1}`).join('\n'))
  await expect
    .poll(async () => (await chat.input.boundingBox())?.height ?? 0)
    .toBeGreaterThan(initialHeight)
})

test('Shift+Enter inserts a line break without submitting', async ({ configuredChat: chat }) => {
  await chat.input.fill('First line')
  await chat.input.press('Shift+Enter')
  await chat.input.type('Second line')

  await expect(chat.input).toHaveValue('First line\nSecond line')
  await expect(chat.page.getByText('First line', { exact: true })).toBeHidden()
})

test('Enter submits and clears input', async ({ configuredChat: chat }) => {
  await chat.submit('Hello there')

  await expect(chat.page.getByText('Hello there', { exact: true })).toBeVisible()
  await expect(chat.input).toHaveValue('')
})

test('the bar offers Plan or Run and Redrob Auto', async ({ configuredChat: chat }) => {
  const composer = chat.page.getByTestId('chat-composer')
  const plan = composer.getByRole('button', { name: 'Plan', exact: true })
  const run = composer.getByRole('button', { name: 'Run', exact: true })
  await expect(plan).toHaveAttribute('aria-pressed', 'true')
  await run.click()
  await expect(run).toHaveAttribute('aria-pressed', 'true')

  const picker = composer.getByRole('button', { name: 'Model', exact: true })
  await expect(picker).toContainText('Redrob Auto')
  await picker.click()
  const away = chat.page.getByRole('button', { name: /GPT-6 Astra/ })
  await expect(away).toBeDisabled()
  await chat.page.getByRole('button', { name: /Claude Opus 5\.5/ }).click()
  await expect(chat.page.getByRole('group', { name: 'Effort' })).toBeVisible()
  await chat.page.keyboard.press('Escape')
  await expect(picker).toContainText('Opus 5.5')
})

test('the status line opens Privacy, Memory and Cross-check', async ({ configuredChat: chat }) => {
  test.setTimeout(45_000)
  const status = chat.page.getByRole('group', { name: 'How Redrob treats every message' })
  await expect(status.getByRole('button')).toHaveCount(3)

  await status.getByRole('button', { name: /^Privacy: High/ }).click()
  await expect(chat.page.getByText('Privacy protection is on')).toBeVisible()
  await chat.page.keyboard.press('Escape')

  await status.getByRole('button', { name: /^Memory:/ }).click()
  await chat.page.getByRole('radio', { name: /Off for this chat/ }).click()
  await chat.page.keyboard.press('Escape')
  await expect(status.getByRole('button', { name: 'Memory: Off' })).toBeVisible()

  await status.getByRole('button', { name: /^Cross-check:/ }).click()
  await chat.page
    .getByRole('radiogroup', { name: 'Fact check' })
    .getByRole('radio', { name: 'Off' })
    .click()
  await chat.page
    .getByRole('radiogroup', { name: 'Challenge' })
    .getByRole('radio', { name: 'Off' })
    .click()
  await chat.page.keyboard.press('Escape')
  await expect(status.getByRole('button', { name: 'Cross-check: Off' })).toBeVisible()
})

test('Privacy runs at the level the person picks and keeps listed names', async ({
  configuredChat: chat
}) => {
  test.setTimeout(45_000)
  const status = chat.page.getByRole('group', { name: 'How Redrob treats every message' })
  await status.getByRole('button', { name: /^Privacy: High/ }).click()
  await expect(chat.page.getByText(/Rules on this computer swap private details/)).toBeVisible()

  const levels = chat.page.getByRole('radiogroup', { name: 'Privacy protection is on' })
  await levels.getByRole('radio', { name: /^Strict/ }).click()
  await expect(levels.getByRole('radio', { name: /^Strict/ })).toHaveAttribute(
    'aria-checked',
    'true'
  )

  const terms = chat.page.getByRole('textbox', { name: /Names to keep private/ })
  await terms.fill('Jane Doe')
  await terms.blur()
  await chat.page.keyboard.press('Escape')
  await expect(status.getByRole('button', { name: /^Privacy: Strict/ })).toBeVisible()

  await status.getByRole('button', { name: /^Privacy: Strict/ }).click()
  await expect(chat.page.getByRole('textbox', { name: /Names to keep private/ })).toHaveValue(
    'Jane Doe'
  )
})

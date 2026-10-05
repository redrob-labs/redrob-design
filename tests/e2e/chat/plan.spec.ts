import { expect, test } from '#tests/helpers/chat/fixture'

test.describe.configure({ timeout: 45_000 })

test('Plan asks with Design Memory and the answers go back as one message', async ({
  configuredChat: chat
}) => {
  await chat.submit('Show plan questions')
  const answer = chat.assistantMessage()
  const questions = answer.getByRole('group', { name: 'Questions' })
  await expect(questions).toBeVisible()

  await answer.getByRole('button', { name: /Design Memory/ }).click()
  const drawer = chat.page.getByTestId('design-memory-drawer')
  await expect(drawer).toBeVisible()
  await expect(drawer).toContainText('No workspace is connected')
  await drawer.getByRole('button', { name: 'Close' }).click()
  await expect(drawer).toBeHidden()

  await questions.getByRole('button', { name: 'Teams of 5 to 50' }).click()
  await questions.getByRole('button', { name: 'Start free' }).click()
  await expect(chat.userMessage()).toContainText('Who pays for it? Teams of 5 to 50')
  await expect(chat.userMessage()).toContainText('What should they do first? Start free')
})

test('an answered Plan card stays answered when the thread is rebuilt', async ({
  configuredChat: chat
}) => {
  await chat.submit('Show plan questions')
  const questions = chat.page.getByRole('group', { name: 'Questions' }).last()
  await questions.getByRole('button', { name: 'Teams of 5 to 50' }).click()
  await questions.getByRole('button', { name: 'Start free' }).click()
  await expect(chat.userMessage()).toContainText('Start free')

  // Switching to Design and back rebuilds the chat from the kept thread.
  await chat.designTab.click()
  await chat.chatTab.click()
  const rebuilt = chat.page.getByRole('group', { name: 'Questions' }).last()
  await expect(rebuilt.getByRole('button', { name: 'Teams of 5 to 50' })).toBeDisabled()
  await expect(rebuilt.getByRole('button', { name: 'Teams of 5 to 50' })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await expect(chat.page.getByRole('button', { name: /^Skip/ })).toHaveCount(0)
})

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

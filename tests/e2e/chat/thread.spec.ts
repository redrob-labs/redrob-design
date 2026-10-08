import { expect, test } from '#tests/helpers/chat/fixture'

test('the progress steps clear when the answer lands and the thread stays', async ({
  configuredChat: chat
}) => {
  test.setTimeout(45_000)
  await chat.submit('Create a frame')
  await expect(chat.assistantMessage().getByText('Created a frame', { exact: false })).toBeVisible()
  await expect(chat.page.getByTestId('chat-typing-indicator')).toHaveCount(0)

  // Switching to Design and back rebuilds the chat from the kept thread.
  await chat.designTab.click()
  await chat.chatTab.click()
  await expect(chat.userMessage()).toContainText('Create a frame')
  await expect(chat.assistantMessage()).toContainText('Created a frame')
})

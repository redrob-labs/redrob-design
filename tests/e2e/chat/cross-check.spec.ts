import { expect, test } from '#tests/helpers/chat/fixture'

test.describe.configure({ timeout: 45_000 })

const FACTS = JSON.stringify({
  findings: [
    { claim: 'Team costs $24 a month', verdict: 'supported', where: 'Price' },
    { claim: 'Caption contrast is below 4.5:1', verdict: 'unsupported', where: 'Caption' }
  ]
})

test('Fact check reads the answer on the Review model and posts what it found', async ({
  configuredChat: chat
}) => {
  await chat.page.evaluate((facts) => {
    const hook = window.redrobDesign?.test?.crossCheckReplies
    if (!hook) throw new Error('Cross-check test hook not available')
    hook([facts], { providerID: 'google', modelID: 'gemini-2.5-pro' })
  }, FACTS)

  await chat.submit('Hello there')
  const card = chat.page.getByRole('region', { name: 'Cross-check' })
  await expect(card).toBeVisible()
  await expect(card).toContainText('Fact check by gemini-2.5-pro')
  // Problems first.
  await expect(card.getByRole('article').first()).toHaveAccessibleName(
    'Caption contrast is below 4.5:1'
  )
  await expect(card).toContainText('Does not hold up')
  await expect(card).toContainText('Holds up')
})

test('with the test transport and no reviewer, Cross-check posts nothing', async ({
  configuredChat: chat
}) => {
  await chat.submit('Hello there')
  await expect(chat.assistantMessage()).toContainText('mock response')
  await expect(chat.page.getByRole('region', { name: 'Cross-check' })).toHaveCount(0)
})

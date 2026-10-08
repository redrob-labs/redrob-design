import { describe, expect, test } from 'bun:test'

import { ToolLoopAgent } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'

import { protectedPrompt } from '@/app/assistant/privacy/prompt'
import { revealForDisplay, setPrivacyLevel } from '@/app/assistant/privacy/store'

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 1, text: 1, reasoning: undefined }
}

describe('privacy protection on a direct model', () => {
  test('the provider never receives the raw value, and the person sees it', async () => {
    setPrivacyLevel('high')
    const prompts: string[] = []
    const owner = {}
    let kept = -1
    const model = new MockLanguageModelV4({
      doGenerate: async (options) => {
        prompts.push(JSON.stringify(options.prompt))
        return {
          content: [{ type: 'text', text: 'I will email [EMAIL_1].' }],
          finishReason: { unified: 'stop', raw: 'stop' },
          usage,
          warnings: []
        }
      }
    })
    const agent = new ToolLoopAgent({
      model,
      instructions: 'SYSTEM',
      prepareCall: (options) => ({
        ...options,
        ...protectedPrompt(owner, options, (count) => {
          kept = count
        })
      })
    })

    const result = await agent.generate({
      messages: [{ role: 'user', content: 'email jane@example.com about pricing' }]
    })

    expect(prompts).toHaveLength(1)
    expect(prompts[0]).not.toContain('jane@example.com')
    expect(prompts[0]).toContain('[EMAIL_1]')
    expect(kept).toBe(1)
    expect(revealForDisplay(owner, result.text)).toBe('I will email jane@example.com.')
  })
})

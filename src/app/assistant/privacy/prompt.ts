import type { ModelMessage } from 'ai'

import { protectRequest } from './store'

/** What an agent's `prepareCall` receives that carries the person's words. */
export interface PromptOptions {
  messages?: ModelMessage[]
  prompt?: string | ModelMessage[]
}

/**
 * Privacy protection for one direct-model request: the person's words go out
 * with placeholders, and `onKept` gets how many details stayed on this
 * computer, for the receipt.
 */
export function protectedPrompt(
  owner: object,
  options: PromptOptions,
  onKept: (count: number) => void
): { messages: ModelMessage[] } | { prompt: string | ModelMessage[] } {
  if (options.messages) {
    const { messages, keptPrivate } = protectRequest(owner, options.messages)
    onKept(keptPrivate)
    return { messages }
  }
  const prompt = options.prompt ?? ''
  const asMessages: ModelMessage[] =
    typeof prompt === 'string' ? [{ role: 'user', content: prompt }] : prompt
  const { messages, keptPrivate } = protectRequest(owner, asMessages)
  onKept(keptPrivate)
  if (typeof prompt === 'string') {
    const content = messages.length === 1 ? messages[0].content : prompt
    return { prompt: typeof content === 'string' ? content : prompt }
  }
  return { prompt: messages }
}

import type { ModelMessage } from 'ai'

import { redactText, type PrivacyVault } from './redact'
import type { PrivacyRule } from './rules'

export interface RedactedMessages {
  messages: ModelMessage[]
  /** Distinct private details kept from the model in this request. */
  keptPrivate: number
}

/**
 * Redacts the person's words in every user message, oldest first, so the
 * placeholders match the ones earlier answers already used. Assistant and
 * tool messages already carry placeholders and pass through.
 */
export function redactModelMessages(
  messages: readonly ModelMessage[],
  rules: readonly PrivacyRule[],
  vault: PrivacyVault
): RedactedMessages {
  const used = new Set<string>()
  const redacted = messages.map((message): ModelMessage => {
    if (message.role !== 'user') return message
    if (typeof message.content === 'string') {
      const result = redactText(message.content, rules, vault)
      for (const placeholder of result.placeholders) used.add(placeholder)
      return { ...message, content: result.text }
    }
    return {
      ...message,
      content: message.content.map((part) => {
        if (part.type !== 'text') return part
        const result = redactText(part.text, rules, vault)
        for (const placeholder of result.placeholders) used.add(placeholder)
        return { ...part, text: result.text }
      })
    }
  })
  return { messages: redacted, keptPrivate: used.size }
}

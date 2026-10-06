import type { UIMessage } from 'ai'

/** The words of a message, without tool calls, reasoning or data parts. */
export function messageText(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
}

/** What the person wrote, message by message. */
export function userTexts(messages: readonly UIMessage[]): string[] {
  return messages.filter((message) => message.role === 'user').map(messageText)
}

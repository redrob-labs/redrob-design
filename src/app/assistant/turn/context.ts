/**
 * Agents that take one prompt string per turn (ACP, Pi) get the turn context
 * in front of the person's words, so a change to Plan, Run or Memory between
 * turns reaches them the same way it reaches direct models.
 */
export function withTurnContext(text: string, context: string): string {
  if (!context) return text
  return `<turn-context>\n${context}\n</turn-context>\n\n${text}`
}

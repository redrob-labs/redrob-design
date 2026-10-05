import { concealKnownText, mapStrings, revealText, type PrivacyVault } from './redact'

interface ExecutableTool {
  execute?: (input: never, options: never) => unknown
}

/**
 * Tools act on the canvas with the real values: placeholders in a tool call
 * are swapped back before it runs, and values the person kept private are
 * swapped out of the result before the model reads it.
 */
export function protectTools<T extends Record<string, ExecutableTool>>(
  tools: T,
  vault: () => PrivacyVault
): T {
  const wrapped: Record<string, ExecutableTool> = {}
  for (const [name, tool] of Object.entries(tools)) {
    const execute = tool.execute
    if (!execute) {
      wrapped[name] = tool
      continue
    }
    wrapped[name] = {
      ...tool,
      execute: (async (input: unknown, options: unknown) => {
        const current = vault()
        const revealed = mapStrings(input, (text) => revealText(text, current))
        const result: unknown = await (execute as (input: unknown, options: unknown) => unknown)(
          revealed,
          options
        )
        return mapStrings(result, (text) => concealKnownText(text, current))
      }) as ExecutableTool['execute']
    }
  }
  return wrapped as T
}

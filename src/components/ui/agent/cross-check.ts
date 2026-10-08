import type { CrossCheckLevelOption, CrossCheckValue } from './types'

/**
 * What the status line says for a Cross-check value: the shared level when
 * every check has the same one, "1 of 2 on" when they differ, else "Off".
 * Mirrors the design system's `CrossCheckSetting.value`.
 */
export function crossCheckSummary(
  value: CrossCheckValue,
  levels: readonly CrossCheckLevelOption[],
  words: { off: string; someOn: (on: number, total: number) => string }
): string {
  const entries = Object.values(value)
  if (entries.length === 0) return words.off
  const on = entries.filter((level) => level !== 'off').length
  if (on === 0) return words.off
  const first = entries[0]
  if (entries.every((level) => level === first)) {
    return levels.find((level) => level.value === first)?.label ?? words.off
  }
  return words.someOn(on, entries.length)
}

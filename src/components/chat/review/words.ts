import type { ReviewSeverity } from '@/app/review/findings'

interface ReviewWords {
  severityHigh: string
  severityMedium: string
  severityLow: string
  ruleColorContrast: string
  ruleHardcodedColor: string
  ruleSpacing: string
  ruleRadius: string
  ruleTextSize: string
  ruleTouchTarget: string
  ruleTextStyle: string
  rulePixels: string
  ruleOther: string
}

const HEADING_KEYS: Partial<Record<string, keyof ReviewWords>> = {
  'color-contrast': 'ruleColorContrast',
  'no-hardcoded-colors': 'ruleHardcodedColor',
  'consistent-spacing': 'ruleSpacing',
  'consistent-radius': 'ruleRadius',
  'min-text-size': 'ruleTextSize',
  'touch-target-size': 'ruleTouchTarget',
  'text-style-required': 'ruleTextStyle',
  'pixel-perfect': 'rulePixels'
}

/** A finding's heading in the reader's words, from the rule that found it. */
export function findingHeading(ruleId: string, words: ReviewWords): string {
  return words[HEADING_KEYS[ruleId] ?? 'ruleOther']
}

export function severityLabel(severity: ReviewSeverity, words: ReviewWords): string {
  if (severity === 'high') return words.severityHigh
  if (severity === 'medium') return words.severityMedium
  return words.severityLow
}

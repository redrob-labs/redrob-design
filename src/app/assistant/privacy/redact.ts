import type { PrivacyRule, PrivateKind } from './rules'

/**
 * Private values and the placeholders that stand for them in one thread.
 * Numbering follows first appearance, so redacting the same messages again
 * gives the same placeholders and the vault can be rebuilt from the thread
 * instead of being stored.
 */
export interface PrivacyVault {
  readonly byValue: Map<string, string>
  readonly byPlaceholder: Map<string, string>
  readonly counters: Map<PrivateKind, number>
}

export function createPrivacyVault(): PrivacyVault {
  return { byValue: new Map(), byPlaceholder: new Map(), counters: new Map() }
}

const PLACEHOLDER = /\[(EMAIL|PHONE|CARD|IBAN|KEY|ID|NAME|NUMBER|URL)_(\d+)\]/g

function placeholderFor(vault: PrivacyVault, kind: PrivateKind, value: string): string {
  const existing = vault.byValue.get(value)
  if (existing) return existing
  const next = (vault.counters.get(kind) ?? 0) + 1
  vault.counters.set(kind, next)
  const placeholder = `[${kind}_${next}]`
  vault.byValue.set(value, placeholder)
  vault.byPlaceholder.set(placeholder, value)
  return placeholder
}

interface Candidate {
  start: number
  end: number
  kind: PrivateKind
  value: string
  order: number
}

function candidatesIn(text: string, rules: readonly PrivacyRule[]): Candidate[] {
  const found: Candidate[] = []
  rules.forEach((rule, order) => {
    for (const match of text.matchAll(rule.pattern)) {
      const value = match[0]
      if (rule.accept && !rule.accept(value)) continue
      found.push({
        start: match.index,
        end: match.index + value.length,
        kind: rule.kind,
        value,
        order
      })
    }
  })
  // Earliest first; at the same start, the longer match, then the earlier rule.
  found.sort((a, b) => a.start - b.start || b.end - a.end || a.order - b.order)
  const kept: Candidate[] = []
  let cursor = 0
  for (const candidate of found) {
    if (candidate.start < cursor) continue
    kept.push(candidate)
    cursor = candidate.end
  }
  return kept
}

export interface RedactResult {
  text: string
  /** Placeholders used in this text, each once. */
  placeholders: Set<string>
}

/** Swaps every private detail the rules find for its placeholder. */
export function redactText(
  text: string,
  rules: readonly PrivacyRule[],
  vault: PrivacyVault
): RedactResult {
  const placeholders = new Set<string>()
  let out = ''
  let cursor = 0
  for (const candidate of candidatesIn(text, rules)) {
    const placeholder = placeholderFor(vault, candidate.kind, candidate.value)
    placeholders.add(placeholder)
    out += text.slice(cursor, candidate.start) + placeholder
    cursor = candidate.end
  }
  return { text: out + text.slice(cursor), placeholders }
}

/** Puts the real values back where the model wrote placeholders. */
export function revealText(text: string, vault: PrivacyVault): string {
  if (vault.byPlaceholder.size === 0) return text
  return text.replace(
    PLACEHOLDER,
    (placeholder) => vault.byPlaceholder.get(placeholder) ?? placeholder
  )
}

/**
 * Replaces values the vault already knows with their placeholders. Used on
 * tool results, so a value the person kept private does not come back to the
 * model through the canvas.
 */
export function concealKnownText(text: string, vault: PrivacyVault): string {
  if (vault.byValue.size === 0) return text
  let out = text
  const values = [...vault.byValue.keys()].sort((a, b) => b.length - a.length)
  for (const value of values) {
    const placeholder = vault.byValue.get(value)
    if (placeholder && out.includes(value)) out = out.replaceAll(value, placeholder)
  }
  return out
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  const proto: unknown = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/** Applies a string transform to every string inside plain data; other values pass through. */
export function mapStrings(value: unknown, transform: (text: string) => string): unknown {
  if (typeof value === 'string') return transform(value)
  if (Array.isArray(value)) return value.map((entry) => mapStrings(entry, transform))
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, mapStrings(entry, transform)])
    )
  }
  return value
}

/**
 * The rules privacy protection runs on this computer. Each finds one kind of
 * private detail; validators drop look-alikes (a 16-digit number that fails
 * Luhn is not a card). No model runs here: these are patterns and checks.
 */

/** Private detail kinds, which name the placeholder: `[EMAIL_1]`. */
export type PrivateKind =
  | 'EMAIL'
  | 'PHONE'
  | 'CARD'
  | 'IBAN'
  | 'KEY'
  | 'ID'
  | 'NAME'
  | 'NUMBER'
  | 'URL'

/** The three levels the composer shows, from the design system's `PrivacyLevel`. */
export type PrivacyLevelId = 'standard' | 'high' | 'strict'

export const PRIVACY_LEVEL_IDS: readonly PrivacyLevelId[] = ['standard', 'high', 'strict']

export function isPrivacyLevelId(value: unknown): value is PrivacyLevelId {
  return value === 'standard' || value === 'high' || value === 'strict'
}

export interface PrivacyRule {
  kind: PrivateKind
  /** Global regular expression; every match is a candidate. */
  pattern: RegExp
  /** Drops candidates that only look private. */
  accept?: (match: string) => boolean
}

function digitsOf(value: string): string {
  return value.replace(/\D/g, '')
}

/** Luhn checksum, which every payment card number passes. */
export function passesLuhn(value: string): boolean {
  const digits = digitsOf(value)
  if (digits.length < 13 || digits.length > 19) return false
  let sum = 0
  let double = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Number(digits[i])
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    double = !double
  }
  return sum % 10 === 0
}

/** ISO 13616 mod-97 check, which every IBAN passes. */
export function passesIBANCheck(value: string): boolean {
  const compact = value.replace(/\s/g, '').toUpperCase()
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(compact)) return false
  const rearranged = compact.slice(4) + compact.slice(0, 4)
  let remainder = 0
  for (const char of rearranged) {
    const code = char >= 'A' && char <= 'Z' ? String(char.charCodeAt(0) - 55) : char
    for (const digit of code) remainder = (remainder * 10 + Number(digit)) % 97
  }
  return remainder === 1
}

/** Bits per character; random keys sit well above words and class names. */
export function shannonEntropy(value: string): number {
  const counts = new Map<string, number>()
  for (const char of value) counts.set(char, (counts.get(char) ?? 0) + 1)
  let entropy = 0
  for (const count of counts.values()) {
    const p = count / value.length
    entropy -= p * Math.log2(p)
  }
  return entropy
}

function looksLikeRandomToken(value: string): boolean {
  return /[A-Za-z]/.test(value) && /\d/.test(value) && shannonEntropy(value) >= 3.5
}

/** Phone numbers: a leading + or at least nine digits, so prices and dates stay. */
function looksLikePhone(value: string): boolean {
  const digits = digitsOf(value)
  if (digits.length < 7 || digits.length > 15) return false
  if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return false
  return value.trim().startsWith('+') || digits.length >= 9
}

/** Numbers with a fixed shape: cards, accounts, government IDs and secret keys. */
const STANDARD_RULES: readonly PrivacyRule[] = [
  {
    kind: 'KEY',
    pattern:
      /\b(?:sk-(?:ant-|proj-)?[A-Za-z0-9_-]{16,}|sk_(?:live|test)_[A-Za-z0-9]{16,}|pk_live_[A-Za-z0-9]{16,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35})/g
  },
  { kind: 'IBAN', pattern: /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]){11,30}\b/g, accept: passesIBANCheck },
  { kind: 'CARD', pattern: /\b(?:\d[ -]?){12,18}\d\b/g, accept: passesLuhn },
  { kind: 'ID', pattern: /\b\d{3}-\d{2}-\d{4}\b/g }
]

/** Also contact details and long random tokens. */
const HIGH_RULES: readonly PrivacyRule[] = [
  ...STANDARD_RULES,
  { kind: 'EMAIL', pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  {
    kind: 'PHONE',
    pattern: /(?<![\w$+])\+?(?:\(\d{1,4}\)[ .-]?)?\d{1,4}(?:[ .-]\d{2,4}){1,4}(?![\w])/g,
    accept: looksLikePhone
  },
  { kind: 'KEY', pattern: /\b[A-Za-z0-9_-]{32,}\b/g, accept: looksLikeRandomToken }
]

/** Also every long number and every web address that carries details. */
const STRICT_RULES: readonly PrivacyRule[] = [
  ...HIGH_RULES,
  { kind: 'URL', pattern: /https?:\/\/[^\s?#"'<>]+\?[^\s#"'<>]+/g },
  { kind: 'NUMBER', pattern: /\b\d{6,}\b/g }
]

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** A rule for the names and terms a person listed as private. */
export function termsRule(terms: readonly string[]): PrivacyRule | null {
  const cleaned = [...new Set(terms.map((term) => term.trim()).filter((term) => term.length >= 2))]
  if (cleaned.length === 0) return null
  cleaned.sort((a, b) => b.length - a.length)
  return {
    kind: 'NAME',
    pattern: new RegExp(
      `(?<![\\p{L}\\p{N}])(?:${cleaned.map(escapeRegExp).join('|')})(?![\\p{L}\\p{N}])`,
      'giu'
    )
  }
}

/** The rules for one level, with listed terms from High up. */
export function rulesFor(level: PrivacyLevelId, terms: readonly string[] = []): PrivacyRule[] {
  if (level === 'standard') return [...STANDARD_RULES]
  const listed = termsRule(terms)
  const base = level === 'strict' ? STRICT_RULES : HIGH_RULES
  return listed ? [listed, ...base] : [...base]
}

/**
 * The privacy levels the composer shows. The masking itself happens in Redrob Code, the engine, in
 * one place for every provider and every Redrob app; what this app keeps is the level the person
 * chose (or a workspace policy locked), and it carries that level to the engine's switch:
 *
 *   standard -> regex   emails, phones, cards, resident numbers
 *   high     -> model   regex plus a local model naming people, organisations and places
 *   strict   -> model   the same masking; Strict is the level a policy reaches for
 */

/** The three levels the composer shows, from the design system's `PrivacyLevel`. */
export type PrivacyLevelId = 'standard' | 'high' | 'strict'

export const PRIVACY_LEVEL_IDS: readonly PrivacyLevelId[] = ['standard', 'high', 'strict']

export function isPrivacyLevelId(value: unknown): value is PrivacyLevelId {
  return value === 'standard' || value === 'high' || value === 'strict'
}

/** The engine's `privacy.mask_pii` value for a level. */
export type EnginePrivacyMode = 'off' | 'regex' | 'model'

export function engineModeForLevel(level: PrivacyLevelId): EnginePrivacyMode {
  return level === 'standard' ? 'regex' : 'model'
}

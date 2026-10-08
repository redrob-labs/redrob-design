import { StorageSerializers, useLocalStorage } from '@vueuse/core'
import type { ModelMessage } from 'ai'
import { computed, shallowReactive } from 'vue'

import { redactModelMessages } from './messages'
import { createPrivacyVault, revealText, type PrivacyVault } from './redact'
import { isPrivacyLevelId, rulesFor, type PrivacyLevelId } from './rules'

const LEVEL_KEY = 'redrob-design:privacy-level'
const TERMS_KEY = 'redrob-design:privacy-terms'

/** The default when nothing is chosen: cards, keys, IDs and contact details. */
export const DEFAULT_PRIVACY_LEVEL: PrivacyLevelId = 'high'

const storedLevel = useLocalStorage<string>(LEVEL_KEY, DEFAULT_PRIVACY_LEVEL, {
  writeDefaults: false
})
const storedTerms = useLocalStorage<unknown>(TERMS_KEY, [], {
  serializer: StorageSerializers.object,
  writeDefaults: false
})

/** Set by a workspace admin; when present it wins and the person cannot change it. */
const lockedLevel = shallowReactive<{ value: PrivacyLevelId | null }>({ value: null })

/** The level privacy protection runs at for every message. */
export const privacyLevel = computed<PrivacyLevelId>(() => {
  if (lockedLevel.value) return lockedLevel.value
  return isPrivacyLevelId(storedLevel.value) ? storedLevel.value : DEFAULT_PRIVACY_LEVEL
})

export const privacyLevelLocked = computed(() => lockedLevel.value !== null)

export function setPrivacyLevel(level: PrivacyLevelId): void {
  storedLevel.value = level
}

/** A workspace policy locks the level; null hands the choice back to the person. */
export function lockPrivacyLevel(level: PrivacyLevelId | null): void {
  lockedLevel.value = level
}

/** Names and other words the person listed as private, kept on this computer. */
export const privateTerms = computed<string[]>(() =>
  Array.isArray(storedTerms.value)
    ? storedTerms.value.filter((term): term is string => typeof term === 'string')
    : []
)

export function setPrivateTerms(terms: readonly string[]): void {
  storedTerms.value = [...new Set(terms.map((term) => term.trim()).filter(Boolean))]
}

const vaults = new WeakMap<object, PrivacyVault>()

/** The thread's current placeholders and the values they stand for. */
export function privacyVaultFor(owner: object): PrivacyVault {
  let vault = vaults.get(owner)
  if (!vault) {
    vault = createPrivacyVault()
    vaults.set(owner, vault)
  }
  return vault
}

/**
 * Redacts one request to a direct model. The vault is rebuilt from the
 * request's own messages, which hold the whole thread, so placeholders stay
 * stable across turns and reloads without the values ever being stored.
 */
export function protectRequest(
  owner: object,
  messages: readonly ModelMessage[]
): { messages: ModelMessage[]; keptPrivate: number } {
  const vault = createPrivacyVault()
  vaults.set(owner, vault)
  return redactModelMessages(messages, rulesFor(privacyLevel.value, privateTerms.value), vault)
}

/**
 * Rebuilds the vault from a thread read back from this computer, so answers
 * written before a reload show real values again.
 */
export function rememberThreadPrivacy(owner: object, userTexts: readonly string[]): void {
  protectRequest(
    owner,
    userTexts.map((text): ModelMessage => ({ role: 'user', content: text }))
  )
}

/** Shows the person real values where the model wrote placeholders. */
export function revealForDisplay(owner: object | null, text: string): string {
  if (!owner) return text
  const vault = vaults.get(owner)
  return vault ? revealText(text, vault) : text
}

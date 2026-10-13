import { StorageSerializers, useLocalStorage } from '@vueuse/core'
import { computed, shallowReactive, watch } from 'vue'

import { connectEngine, engineHeaders } from '@/app/ai/engine/daemon'

import { engineModeForLevel, isPrivacyLevelId, type PrivacyLevelId } from './rules'

const LEVEL_KEY = 'redrob-design:privacy-level'
const TERMS_KEY = 'redrob-design:privacy-terms'

/** The default when nothing is chosen: cards, keys, IDs and contact details, plus names. */
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

/**
 * Names and other words the person listed as private, kept on this computer. The engine's masker
 * takes no list of its own yet; the list is kept so a workspace policy's terms are not lost.
 */
export const privateTerms = computed<string[]>(() =>
  Array.isArray(storedTerms.value)
    ? storedTerms.value.filter((term): term is string => typeof term === 'string')
    : []
)

export function setPrivateTerms(terms: readonly string[]): void {
  storedTerms.value = [...new Set(terms.map((term) => term.trim()).filter(Boolean))]
}

type PrivacyFetch = (url: string, init: RequestInit) => Promise<Response>

/**
 * Carry the level to the engine (`PUT /api/privacy`). The engine masks for every provider and every
 * app; one switch, so the level set here is what Cowork and Office run under too. Fails loudly: a
 * caller learns the engine did not take it, rather than a level being shown that is not enforced.
 */
export async function syncEnginePrivacy(
  level: PrivacyLevelId = privacyLevel.value,
  fetcher: PrivacyFetch = fetch
): Promise<void> {
  const daemon = await connectEngine()
  const response = await fetcher(`${daemon.url.replace(/\/+$/, '')}/api/privacy`, {
    method: 'PUT',
    headers: { ...engineHeaders(daemon), 'content-type': 'application/json' },
    body: JSON.stringify({ mode: engineModeForLevel(level) })
  })
  if (!response.ok)
    throw new Error(`The engine did not accept the privacy level (${response.status})`)
}

let syncing = false

/** Keeps the engine's switch in step with the level, for as long as the app runs. */
export function startEnginePrivacySync(onError: (error: unknown) => void = console.error): void {
  if (syncing) return
  syncing = true
  watch(privacyLevel, (level) => void syncEnginePrivacy(level).catch(onError), { immediate: true })
}

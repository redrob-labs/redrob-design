import type { AIProviderID } from '@redrob-design/core/constants'

import { appCredentialStore } from '@/app/settings/credentials/app'
import { credentialRef } from '@/app/settings/credentials/reference'
import { browserCredentialStorage } from '@/app/settings/credentials/storage'
import type { CredentialRef, CredentialStore } from '@/app/settings/credentials/types'

const STORAGE_PREFIX = 'redrob-design:'
const MIGRATION_VERSION_KEY = `${STORAGE_PREFIX}credential-migration`
const MIGRATION_VERSION = '2'

export function providerCredentialRef(
  providerId: AIProviderID,
  profileId = 'default'
): CredentialRef {
  if (providerId.startsWith('acp:')) {
    throw new Error('ACP agents do not use API-key credentials')
  }
  return credentialRef(providerId, 'api-key', profileId)
}

export const PEXELS_CREDENTIAL = credentialRef('pexels', 'api-key')
export const UNSPLASH_CREDENTIAL = credentialRef('unsplash', 'access-key')

type LegacyCredential = {
  storageKey: string
  reference: CredentialRef
}

function legacyCredentials(): LegacyCredential[] {
  return [
    { storageKey: `${STORAGE_PREFIX}pexels-api-key`, reference: PEXELS_CREDENTIAL },
    { storageKey: `${STORAGE_PREFIX}unsplash-access-key`, reference: UNSPLASH_CREDENTIAL }
  ]
}

/**
 * Plaintext model-provider keys an earlier build left in local storage (`ai-key:<provider>` and the
 * first OpenRouter key). Models run through the engine now and this app keeps no provider key, so
 * these are not migrated anywhere: they are removed, which is the one thing a key nobody reads
 * should have happen to it.
 */
export function legacyProviderKeyStorageKeys(storage: Storage): string[] {
  const keys: string[] = []
  for (let index = 0; index < storage.length; index++) {
    const storageKey = storage.key(index)
    if (!storageKey) continue
    if (
      storageKey.startsWith(`${STORAGE_PREFIX}ai-key:`) ||
      storageKey === `${STORAGE_PREFIX}openrouter-api-key`
    ) {
      keys.push(storageKey)
    }
  }
  return keys
}

export async function migrateLegacyCredentials(
  storage: Storage,
  store: CredentialStore
): Promise<boolean> {
  if (storage.getItem(MIGRATION_VERSION_KEY) === MIGRATION_VERSION) return true
  if ((await store.availability()) !== 'available') return false

  const credentials = legacyCredentials()
  for (const { storageKey, reference } of credentials) {
    const legacyValue = storage.getItem(storageKey)?.trim()
    if (!legacyValue) continue

    const existing = await store.read(reference)
    if (existing === null) await store.write(reference, legacyValue)
    if ((await store.read(reference)) === null) return false
    storage.removeItem(storageKey)
  }

  for (const storageKey of legacyProviderKeyStorageKeys(storage)) storage.removeItem(storageKey)

  storage.setItem(MIGRATION_VERSION_KEY, MIGRATION_VERSION)
  return true
}

export async function initializeCredentialMigration(): Promise<boolean> {
  const storage = browserCredentialStorage()
  if (!storage) return true
  return migrateLegacyCredentials(storage, appCredentialStore)
}

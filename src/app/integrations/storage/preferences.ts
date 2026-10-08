import { useLocalStorage } from '@vueuse/core'

import { storageProviderRegistry } from './providers'
import type { StorageFieldID, StorageProviderID } from './types'

/** Where documents sync. Other profiles hold buckets for other jobs. */
export const DEFAULT_STORAGE_PROFILE = 'default'
/** The bucket shipped pages are published to, kept apart so the storage bucket stays private. */
export const PUBLISH_STORAGE_PROFILE = 'publish'

export type StorageProfileID = typeof DEFAULT_STORAGE_PROFILE | typeof PUBLISH_STORAGE_PROFILE

type FieldValues = Record<StorageFieldID, string>

/** Before profiles: one set of fields per provider. */
export type StoragePreferences = Record<StorageProviderID, FieldValues>

/** Fields per provider, per profile. */
export type StorageProfilePreferences = Record<
  StorageProviderID,
  Partial<Record<StorageProfileID, FieldValues>>
>

export const activeStorageProviderID = useLocalStorage<StorageProviderID>(
  'redrob-design:storage:provider',
  's3-compatible'
)

const LEGACY_KEY = 'redrob-design:storage:preferences'
const PROFILES_KEY = 'redrob-design:storage:profile-preferences'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function fieldValues(value: unknown): FieldValues {
  if (!isRecord(value)) return {}
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  )
}

/**
 * Moves provider-keyed preferences into each provider's `default` profile.
 * Profiles already stored win; the legacy value is only read, never removed,
 * so an older build on the same machine keeps working.
 */
export function migrateStoragePreferences(
  legacy: unknown,
  current: unknown
): StorageProfilePreferences {
  const migrated: StorageProfilePreferences = {}
  if (isRecord(legacy)) {
    for (const [providerID, fields] of Object.entries(legacy)) {
      migrated[providerID] = { [DEFAULT_STORAGE_PROFILE]: fieldValues(fields) }
    }
  }
  if (isRecord(current)) {
    for (const [providerID, profiles] of Object.entries(current)) {
      if (!isRecord(profiles)) continue
      const merged = { ...migrated[providerID] }
      for (const profileID of [DEFAULT_STORAGE_PROFILE, PUBLISH_STORAGE_PROFILE] as const) {
        if (profileID in profiles) merged[profileID] = fieldValues(profiles[profileID])
      }
      migrated[providerID] = merged
    }
  }
  return migrated
}

const legacyPreferences = useLocalStorage<unknown>(LEGACY_KEY, null, {
  serializer: {
    read: (raw) => JSON.parse(raw) as unknown,
    write: (value) => JSON.stringify(value)
  },
  writeDefaults: false
})
const storedPreferences = useLocalStorage<StorageProfilePreferences>(
  PROFILES_KEY,
  {},
  {
    writeDefaults: false
  }
)
storedPreferences.value = migrateStoragePreferences(
  legacyPreferences.value,
  storedPreferences.value
)

export function readStoragePreferences(
  providerID: StorageProviderID,
  profileID: StorageProfileID = DEFAULT_STORAGE_PROFILE
): Readonly<FieldValues> {
  return { ...storedPreferences.value[providerID]?.[profileID] }
}

export function writeStoragePreference(
  providerID: StorageProviderID,
  field: StorageFieldID,
  value: string,
  profileID: StorageProfileID = DEFAULT_STORAGE_PROFILE
): void {
  const provider = storageProviderRegistry.get(providerID)
  if (!provider.preferenceFields.some((definition) => definition.id === field)) {
    throw new Error(`Unknown preference field for ${providerID}: ${field}`)
  }
  const profiles = storedPreferences.value[providerID] ?? {}
  storedPreferences.value = {
    ...storedPreferences.value,
    [providerID]: {
      ...profiles,
      [profileID]: { ...profiles[profileID], [field]: value.trim() }
    }
  }
}

export function storagePreferencesComplete(
  providerID: StorageProviderID,
  profileID: StorageProfileID = DEFAULT_STORAGE_PROFILE
): boolean {
  const provider = storageProviderRegistry.get(providerID)
  const preferences = readStoragePreferences(providerID, profileID)
  return provider.preferenceFields.every(
    (field) => !field.required || Boolean(preferences[field.id]?.trim())
  )
}

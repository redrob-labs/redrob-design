import { appCredentialServices } from '@/app/settings/credentials/app'
import { credentialRef } from '@/app/settings/credentials/reference'
import type { CredentialRef, CredentialStatus } from '@/app/settings/credentials/types'

import {
  DEFAULT_STORAGE_PROFILE,
  activeStorageProviderID,
  readStoragePreferences,
  type StorageProfileID
} from './preferences'
import { storageProviderRegistry } from './providers'
import type { StorageAdapter, StorageProviderID } from './types'

export function storageCredentialRefs(
  providerID: StorageProviderID,
  profileID: StorageProfileID = DEFAULT_STORAGE_PROFILE
): CredentialRef[] {
  return storageProviderRegistry
    .get(providerID)
    .credentialFields.map((field) => credentialRef(providerID, field.id, profileID))
}

export async function storageCredentialStatuses(
  providerID: StorageProviderID,
  profileID: StorageProfileID = DEFAULT_STORAGE_PROFILE
): Promise<Record<string, CredentialStatus>> {
  const provider = storageProviderRegistry.get(providerID)
  const entries = await Promise.all(
    provider.credentialFields.map(async (field) => {
      const status = await appCredentialServices.manager.status(
        credentialRef(providerID, field.id, profileID)
      )
      return [field.id, status] as const
    })
  )
  return Object.fromEntries(entries)
}

/** An adapter for one profile: its own bucket fields and its own credentials. */
export function createActiveStorageAdapter(
  providerID: StorageProviderID = activeStorageProviderID.value,
  profileID: StorageProfileID = DEFAULT_STORAGE_PROFILE
): StorageAdapter {
  return storageProviderRegistry.createAdapter(providerID, {
    preferences: readStoragePreferences(providerID, profileID),
    credentials: appCredentialServices.resolver,
    profileId: profileID
  })
}

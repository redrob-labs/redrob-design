import { VECTORIZE_CREDENTIAL_REFS } from '@/app/editor/vectorize/credentials'
import { mcpConnectionSettings, mcpConnectionCredentialRef } from '@/app/integrations/mcp'
import { storageCredentialRefs, storageProviderRegistry } from '@/app/integrations/storage'
import { PEXELS_CREDENTIAL, UNSPLASH_CREDENTIAL } from '@/app/settings/credentials/migration'
import { credentialKey } from '@/app/settings/credentials/reference'

import { setBrowserCredentialPersistence } from './app'
import type { CredentialRef } from './types'

function uniqueCredentialRefs(references: CredentialRef[]): CredentialRef[] {
  return [...new Map(references.map((reference) => [credentialKey(reference), reference])).values()]
}

export function appCredentialRefs(): CredentialRef[] {
  // No model credentials: the engine holds the Redrob key, this app never does.
  const storageCredentials = storageProviderRegistry
    .list()
    .flatMap((provider) => storageCredentialRefs(provider.id))
  return uniqueCredentialRefs([
    PEXELS_CREDENTIAL,
    UNSPLASH_CREDENTIAL,
    ...VECTORIZE_CREDENTIAL_REFS,
    ...mcpConnectionSettings.value.connections.map((connection) =>
      mcpConnectionCredentialRef(connection.id)
    ),
    ...storageCredentials
  ])
}

export function setAppCredentialPersistence(remembered: boolean): Promise<void> {
  return setBrowserCredentialPersistence(remembered, appCredentialRefs())
}

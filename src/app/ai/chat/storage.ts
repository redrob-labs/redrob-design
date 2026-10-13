import { computed, ref, watch } from 'vue'

import { IS_TAURI } from '@redrob-design/core/constants'
import { setPexelsAPIKey, setUnsplashAccessKey } from '@redrob-design/core/tools'

import { sharedAccountRevision, startSharedAccountWatch } from '@/app/ai/connect/app-shared-account'
import {
  designCustomAPIType,
  designCustomBaseURL,
  designCustomModelID,
  designMaxOutputTokens,
  designModelConnection,
  designModelID,
  designProviderDefinition,
  designProviderID,
  modelConnectionCredentialStatus,
  resolveModelConnectionAPIKey,
  setModelConnectionAPIKey
} from '@/app/ai/models'
import { appCredentialServices, browserCredentialsRemembered } from '@/app/settings/credentials/app'
import {
  initializeCredentialMigration,
  PEXELS_CREDENTIAL,
  UNSPLASH_CREDENTIAL
} from '@/app/settings/credentials/migration'
import { setAppCredentialPersistence } from '@/app/settings/credentials/persistence'
import type { CredentialRef, CredentialStatus } from '@/app/settings/credentials/types'

export const providerID = designProviderID
export const modelID = designModelID
export const customBaseURL = designCustomBaseURL
export const customModelID = designCustomModelID
export const customAPIType = designCustomAPIType
export const maxOutputTokens = designMaxOutputTokens
export const providerDef = designProviderDefinition

export const apiKeyStatus = ref<CredentialStatus>('missing')
export const pexelsKeyStatus = ref<CredentialStatus>('missing')
export const unsplashKeyStatus = ref<CredentialStatus>('missing')
const credentialRevision = ref(0)

export const isACPProvider = computed(() => providerID.value.startsWith('acp:'))
export const isAgentProvider = isACPProvider

/**
 * Configured means the engine can run this: the ACP agent needs the desktop app (it spawns the
 * engine); a model profile needs the engine reachable and signed in to Redrob (models/runtime.ts).
 */
export const isConfigured = computed(() => {
  if (isACPProvider.value) return IS_TAURI
  return apiKeyStatus.value === 'configured'
})

async function refreshStatus(reference: CredentialRef): Promise<CredentialStatus> {
  return appCredentialServices.manager.status(reference)
}

/**
 * The Design connection's status goes through the model layer, which counts Redrob
 * Launcher's shared sign-in as configured when the app has no key of its own.
 */
export async function refreshAIProviderStatus(): Promise<void> {
  const connection = designModelConnection.value
  apiKeyStatus.value = connection ? await modelConnectionCredentialStatus(connection.id) : 'missing'
}

async function refreshMediaCredentials(): Promise<void> {
  const [pexelsStatus, unsplashStatus] = await Promise.all([
    refreshStatus(PEXELS_CREDENTIAL),
    refreshStatus(UNSPLASH_CREDENTIAL)
  ])
  pexelsKeyStatus.value = pexelsStatus
  unsplashKeyStatus.value = unsplashStatus
  setPexelsAPIKey(
    pexelsStatus === 'configured'
      ? await appCredentialServices.resolver.resolve(PEXELS_CREDENTIAL)
      : null
  )
  setUnsplashAccessKey(
    unsplashStatus === 'configured'
      ? await appCredentialServices.resolver.resolve(UNSPLASH_CREDENTIAL)
      : null
  )
}

export const credentialsReady = initializeCredentialMigration().then(async () => {
  await Promise.all([refreshAIProviderStatus(), refreshMediaCredentials()])
  return undefined
})

export async function resolveAPIKey(): Promise<string | null> {
  await credentialsReady
  const connection = designModelConnection.value
  return connection ? resolveModelConnectionAPIKey(connection.id) : null
}

/** Hands a Redrob key to the engine (or removes it there); the app keeps no key of its own. */
export async function setAPIKey(key: string): Promise<void> {
  const connection = designModelConnection.value
  if (!connection) return
  await setModelConnectionAPIKey(connection.id, key)
  await refreshAIProviderStatus()
  credentialRevision.value++
}

export async function setPexelsKey(key: string): Promise<void> {
  const value = key.trim()
  if (value) await appCredentialServices.manager.set(PEXELS_CREDENTIAL, value)
  else await appCredentialServices.manager.clear(PEXELS_CREDENTIAL)
  pexelsKeyStatus.value = await refreshStatus(PEXELS_CREDENTIAL)
  setPexelsAPIKey(value || null)
}

export async function setUnsplashKey(key: string): Promise<void> {
  const value = key.trim()
  if (value) await appCredentialServices.manager.set(UNSPLASH_CREDENTIAL, value)
  else await appCredentialServices.manager.clear(UNSPLASH_CREDENTIAL)
  unsplashKeyStatus.value = await refreshStatus(UNSPLASH_CREDENTIAL)
  setUnsplashAccessKey(value || null)
}

export async function setRememberCredentials(remembered: boolean): Promise<void> {
  await credentialsReady
  await setAppCredentialPersistence(remembered)
  await Promise.all([refreshAIProviderStatus(), refreshMediaCredentials()])
  credentialRevision.value++
}

export { browserCredentialsRemembered }

export function registerAIChatEffects(markTransportDirty: () => void) {
  watch(
    () => designModelConnection.value?.id,
    () => {
      void refreshAIProviderStatus()
      markTransportDirty()
    }
  )
  watch(modelID, markTransportDirty)
  watch(customModelID, markTransportDirty)
  watch(customAPIType, markTransportDirty)
  watch(customBaseURL, markTransportDirty)
  watch(maxOutputTokens, markTransportDirty)
  watch(credentialRevision, markTransportDirty)
  // A launcher sign-in or sign-out changes the key a Redrob connection resolves to, so the
  // transport holding the old key is rebuilt the same way it is when the app's own key changes.
  watch(sharedAccountRevision, () => {
    void refreshAIProviderStatus()
    markTransportDirty()
  })
  startSharedAccountWatch()
}

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from '@redrob-design/vue'

import { useNotificationMessages } from '@/app/i18n/notifications'
import {
  activeStorageProviderID,
  createActiveStorageAdapter,
  readStoragePreferences,
  storageCredentialStatuses,
  storagePreferencesComplete,
  storageProviderRegistry,
  writeStoragePreference,
  type StorageProfileID
} from '@/app/integrations/storage'
import { appCredentialServices } from '@/app/settings/credentials/app'
import { credentialRef } from '@/app/settings/credentials/reference'
import type { CredentialStatus } from '@/app/settings/credentials/types'
import { toast } from '@/app/shell/ui'
import AppInput from '@/components/ui/AppInput.vue'

/**
 * Bucket fields and credentials for one storage profile. The component reads
 * only credential status and replaces or clears secrets; it never reads them.
 */
const { profile, testIdPrefix } = defineProps<{
  profile: StorageProfileID
  /** Prefix for `data-test-id` integration hooks, kept stable per profile. */
  testIdPrefix: string
}>()
const emit = defineEmits<{ changed: [] }>()
defineSlots<{ default?(): unknown; actions?(): unknown }>()

const { storage, credentials, common } = useI18n()
const notifications = useNotificationMessages()
const provider = computed(() => storageProviderRegistry.get(activeStorageProviderID.value))
const preferenceDrafts = ref<Record<string, string>>({
  ...readStoragePreferences(provider.value.id, profile)
})
const credentialDrafts = ref<Record<string, string>>({})
const credentialStatuses = ref<Record<string, CredentialStatus>>({})
const busy = ref(false)

const configured = computed(
  () =>
    storagePreferencesComplete(provider.value.id, profile) &&
    provider.value.credentialFields.every(
      (field) => !field.required || credentialStatuses.value[field.id] === 'configured'
    )
)
defineExpose({ configured })

function preferenceLabel(field: string): string {
  if (field === 'endpoint') return storage.value.endpoint
  if (field === 'bucket') return storage.value.bucket
  if (field === 'region') return storage.value.region
  return field
}

function credentialLabel(field: string): string {
  if (field === 'access-key-id') return storage.value.accessKeyID
  if (field === 'secret-access-key') return storage.value.secretAccessKey
  return field
}

async function refreshStatuses(): Promise<void> {
  credentialStatuses.value = await storageCredentialStatuses(provider.value.id, profile)
}

function savePreferences(): void {
  for (const field of provider.value.preferenceFields) {
    writeStoragePreference(
      provider.value.id,
      field.id,
      preferenceDrafts.value[field.id] ?? '',
      profile
    )
  }
  emit('changed')
}

async function saveCredential(field: string): Promise<void> {
  const value = credentialDrafts.value[field]?.trim()
  if (!value) return
  await appCredentialServices.manager.set(credentialRef(provider.value.id, field, profile), value)
  credentialDrafts.value[field] = ''
  await refreshStatuses()
  emit('changed')
}

async function clearCredential(field: string): Promise<void> {
  await appCredentialServices.manager.clear(credentialRef(provider.value.id, field, profile))
  credentialDrafts.value[field] = ''
  await refreshStatuses()
}

async function testConnection(): Promise<void> {
  busy.value = true
  try {
    savePreferences()
    for (const field of provider.value.credentialFields) await saveCredential(field.id)
    const connection = await createActiveStorageAdapter(provider.value.id, profile).testConnection()
    if (connection.ok) toast.info(notifications.value.storageConnected)
    else toast.error(notifications.value.storageConnectionFailed({ error: connection.message }))
  } catch (error) {
    toast.error(
      notifications.value.storageConnectionFailed({
        error: error instanceof Error ? error.message : String(error)
      })
    )
  } finally {
    busy.value = false
  }
}

watch(activeStorageProviderID, (providerID) => {
  preferenceDrafts.value = { ...readStoragePreferences(providerID, profile) }
  credentialDrafts.value = {}
  void refreshStatuses()
})

onMounted(() => void refreshStatuses())
</script>

<template>
  <div class="flex flex-col gap-3" :data-storage-profile="profile">
    <label
      v-for="field in provider.preferenceFields"
      :key="field.id"
      class="flex flex-col gap-1 text-[10px] text-muted"
    >
      {{ preferenceLabel(field.id) }}
      <AppInput
        v-model="preferenceDrafts[field.id]"
        :placeholder="field.placeholder"
        size="sm"
        tone="panel"
        @change="savePreferences"
      />
    </label>

    <div
      v-for="field in provider.credentialFields"
      :key="field.id"
      class="flex flex-col gap-1"
      :data-credential="field.id"
    >
      <label :for="`${testIdPrefix}-${field.id}`" class="text-[10px] text-muted">
        {{ credentialLabel(field.id) }}
      </label>
      <div class="flex gap-2">
        <AppInput
          :id="`${testIdPrefix}-${field.id}`"
          v-model="credentialDrafts[field.id]"
          type="password"
          :aria-label="credentialLabel(field.id)"
          :placeholder="
            credentialStatuses[field.id] === 'configured'
              ? credentials.savedReplace
              : field.placeholder
          "
          size="sm"
          tone="panel"
          class="min-w-0 flex-1"
          @enter="saveCredential(field.id)"
        />
        <button
          v-if="credentialDrafts[field.id]?.trim()"
          type="button"
          class="rounded bg-hover px-2 text-[10px] text-surface hover:bg-active"
          @click="saveCredential(field.id)"
        >
          {{ common.save }}
        </button>
        <button
          v-else-if="credentialStatuses[field.id] === 'configured'"
          type="button"
          class="rounded px-2 text-[10px] text-muted hover:bg-hover hover:text-surface"
          @click="clearCredential(field.id)"
        >
          {{ common.clear }}
        </button>
      </div>
    </div>

    <slot />

    <button
      type="button"
      class="mt-1 rounded bg-accent px-3 py-1.5 text-[11px] font-medium text-on-accent hover:bg-accent-hover disabled:opacity-50"
      :disabled="busy"
      :data-test-id="`${testIdPrefix}-test`"
      @click="testConnection"
    >
      {{ common.testConnection }}
    </button>

    <slot name="actions" />
  </div>
</template>

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from '@redrob-design/vue'

import {
  DEFAULT_STORAGE_PROFILE,
  activeStorageProviderID,
  storageProviderRegistry
} from '@/app/integrations/storage'
import { settingsDialogOpen } from '@/app/settings/dialog'
import { resumeStorageSync } from '@/app/storage/sync'
import SettingsSectionHeader from '@/components/settings/layout/SettingsSectionHeader.vue'
import PublishSiteSettings from '@/components/settings/storage/PublishSiteSettings.vue'
import StorageProfileFields from '@/components/settings/storage/StorageProfileFields.vue'

const { storage, settings } = useI18n()
const router = useRouter()
const provider = computed(() => storageProviderRegistry.get(activeStorageProviderID.value))
const fields = useTemplateRef<{ configured: boolean }>('fields')
const configured = computed(() => fields.value?.configured ?? false)

async function openWorkspace(): Promise<void> {
  settingsDialogOpen.value = false
  await router.push('/storage')
}
</script>

<template>
  <section class="flex flex-col gap-3" data-test-id="settings-storage-panel">
    <SettingsSectionHeader>
      {{ settings.sectionStorage }}
      <template #description>{{ provider.description }}</template>
    </SettingsSectionHeader>

    <StorageProfileFields
      ref="fields"
      :profile="DEFAULT_STORAGE_PROFILE"
      test-id-prefix="settings-storage"
      @changed="resumeStorageSync"
    >
      <template #actions>
        <button
          type="button"
          class="rounded border border-border px-3 py-1.5 text-[11px] font-medium text-surface hover:bg-hover disabled:text-muted disabled:opacity-50"
          :disabled="!configured"
          data-test-id="settings-storage-open-workspace"
          @click="openWorkspace"
        >
          {{ storage.openWorkspace }}
        </button>
      </template>
    </StorageProfileFields>

    <PublishSiteSettings />
  </section>
</template>

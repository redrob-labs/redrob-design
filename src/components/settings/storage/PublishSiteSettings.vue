<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStorageMessages } from '@redrob-design/vue'

import { PUBLISH_STORAGE_PROFILE } from '@/app/integrations/storage'
import { normalizePublicSiteURL, publishSiteURL } from '@/app/ship/publish/site'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import StorageProfileFields from '@/components/settings/storage/StorageProfileFields.vue'
import AppInput from '@/components/ui/AppInput.vue'

/**
 * Where Publish uploads shipped pages: its own bucket and keys, apart from
 * the storage bucket, and the public address that bucket is served from.
 */
const t = useStorageMessages()
const draft = ref(publishSiteURL.value)
const touched = ref(false)

const problem = computed(() => {
  if (!touched.value) return null
  const result = normalizePublicSiteURL(draft.value)
  if (result.ok || result.reason === 'empty') return null
  return result.reason === 'not-https' ? t.value.siteURLNotHttps : t.value.siteURLInvalid
})

function save(): void {
  touched.value = true
  const result = normalizePublicSiteURL(draft.value)
  if (result.ok) {
    publishSiteURL.value = result.url
    draft.value = result.url
  } else if (result.reason === 'empty') {
    publishSiteURL.value = ''
  }
}
</script>

<template>
  <SettingsGroup
    :heading="t.publishHeading"
    :description="t.publishDescription"
    data-test-id="settings-publish-site"
  >
    <div class="flex flex-col gap-3 py-3">
      <StorageProfileFields :profile="PUBLISH_STORAGE_PROFILE" test-id-prefix="settings-publish">
        <div class="flex flex-col gap-1 text-[10px] text-muted">
          <label for="publish-site-url">{{ t.publicSiteURL }}</label>
          <AppInput
            id="publish-site-url"
            v-model="draft"
            placeholder="https://site.example.com"
            size="sm"
            tone="panel"
            :aria-invalid="problem ? 'true' : undefined"
            :aria-describedby="problem ? 'publish-site-url-problem' : 'publish-site-url-hint'"
            @change="save"
          />
          <span v-if="problem" id="publish-site-url-problem" role="alert" class="text-error">
            {{ problem }}
          </span>
          <span v-else id="publish-site-url-hint">{{ t.publicSiteURLHint }}</span>
        </div>
      </StorageProfileFields>
    </div>
  </SettingsGroup>
</template>

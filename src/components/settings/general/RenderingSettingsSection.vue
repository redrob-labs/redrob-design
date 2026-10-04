<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@redrob-design/vue'

import { appRuntimeConfig } from '@/app/runtime/config'
import { appPreferences, updateCanvasRenderingMode } from '@/app/settings/preferences/store'
import AppSwitch from '@/components/ui/AppSwitch.vue'
import SettingsRow from '@/components/settings/layout/SettingsRow.vue'

const { rendering } = useI18n()
const hasURLOverride = appRuntimeConfig.sceneRendererOverride
const tiledRendering = computed(() => appPreferences.value.rendering.canvasMode === 'tiled')
const changed = computed(
  () => appPreferences.value.rendering.canvasMode !== appRuntimeConfig.sceneRenderer
)
const note = computed(() => {
  if (hasURLOverride) return rendering.value.urlOverride
  if (changed.value) return rendering.value.reloadRequired
  return null
})

function setTiledRendering(enabled: boolean): void {
  updateCanvasRenderingMode(enabled ? 'tiled' : 'retained')
}
</script>

<template>
  <div>
    <SettingsRow
      :heading="rendering.progressiveTiled"
      :description="rendering.progressiveTiledDescription"
    >
      <AppSwitch
        :model-value="tiledRendering"
        :label="rendering.progressiveTiled"
        data-test-id="settings-progressive-tiled-rendering"
        @update:model-value="setTiledRendering"
      />
    </SettingsRow>
    <p v-if="note" class="pb-3 text-xs text-muted">{{ note }}</p>
  </div>
</template>

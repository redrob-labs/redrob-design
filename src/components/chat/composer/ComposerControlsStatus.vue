<script setup lang="ts">
import { ref } from 'vue'

import ComposerStatus from '@/components/ui/agent/ComposerStatus.vue'
import CrossCheckSetting from '@/components/ui/agent/CrossCheckSetting.vue'
import MemoryScope from '@/components/ui/agent/MemoryScope.vue'
import PrivacyProtection from '@/components/ui/agent/PrivacyProtection.vue'
import type { MemoryScopeValue } from '@/app/assistant/controls/model'
import { assistantControlsFor } from '@/app/assistant/controls/store'
import { useEditorStore } from '@/app/editor/active-store'

import { useComposerControls } from './useComposerControls'

/** Privacy, Memory and Cross-check under the composer, with their panels. */
const controls = assistantControlsFor(useEditorStore())
defineSlots<{ end?(): unknown }>()

const {
  t,
  statusItems,
  privacyLevels,
  memoryOptions,
  crossChecks,
  crossCheckLevels,
  crossCheckValue
} = useComposerControls(controls)
const open = ref<string | null>(null)

function isMemoryScope(value: string): value is MemoryScopeValue {
  return value === 'project' || value === 'all' || value === 'none'
}

function setMemory(value: string): void {
  if (isMemoryScope(value)) controls.memory = value
}
</script>

<template>
  <div class="flex items-center gap-1">
    <ComposerStatus v-model:open="open" :items="statusItems" :label="t.statusLabel" class="flex-1">
      <template #panel-privacy>
        <PrivacyProtection
          level="high"
          :levels="privacyLevels"
          :heading="t.privacyHeading"
          :running="t.privacyRunning"
          :summary="t.privacySummary"
        >
          <template #foot>
            <span>{{ t.privacyAdmin }}</span>
          </template>
        </PrivacyProtection>
      </template>
      <template #panel-memory>
        <MemoryScope
          :model-value="controls.memory"
          :options="memoryOptions"
          :label="t.memoryLabel"
          :on-title="t.memoryOnTitle"
          :off-title="t.memoryOffTitle"
          :off-text="t.memoryOffText"
          @update:model-value="setMemory"
        >
          <template #foot>
            <span>{{ t.memoryFoot }}</span>
          </template>
        </MemoryScope>
      </template>
      <template #panel-check>
        <CrossCheckSetting
          v-model="crossCheckValue"
          :checks="crossChecks"
          :levels="crossCheckLevels"
          :heading="t.crossCheck"
          :lede="t.crossCheckLede"
        >
          <template #foot>
            <span>{{ t.crossCheckFoot }}</span>
          </template>
        </CrossCheckSetting>
      </template>
    </ComposerStatus>
    <slot name="end" />
  </div>
</template>

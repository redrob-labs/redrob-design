<script setup lang="ts">
import { ref } from 'vue'

import ComposerStatus from '@/components/ui/agent/ComposerStatus.vue'
import CrossCheckSetting from '@/components/ui/agent/CrossCheckSetting.vue'
import MemoryScope from '@/components/ui/agent/MemoryScope.vue'
import PrivacyProtection from '@/components/ui/agent/PrivacyProtection.vue'
import type { MemoryScopeValue } from '@/app/assistant/controls/model'
import { assistantControlsFor } from '@/app/assistant/controls/store'
import { isPrivacyLevelId } from '@/app/assistant/privacy/rules'
import {
  privacyLevel,
  privacyLevelLocked,
  privateTerms,
  setPrivacyLevel,
  setPrivateTerms
} from '@/app/assistant/privacy/store'
import { useEditorStore } from '@/app/editor/active-store'
import { loadPersonalNotes } from '@/app/memory/notes/store'
import { openSettingsDialog } from '@/app/settings/dialog'
import AppButton from '@/components/ui/AppButton.vue'
import AppTextarea from '@/components/ui/AppTextarea.vue'

import { useComposerControls } from './useComposerControls'

/** Privacy, Memory and Cross-check under the composer, with their panels. */
const controls = assistantControlsFor(useEditorStore())
defineSlots<{ end?(): unknown }>()

const {
  t,
  statusItems,
  privacyLevels,
  agentProvider,
  reviewModelReady,
  memoryOptions,
  crossChecks,
  crossCheckLevels,
  crossCheckValue
} = useComposerControls(controls)
const open = ref<string | null>(null)
// Read the notes early, so the first answer under All my work already has them.
void loadPersonalNotes()
const termsText = ref(privateTerms.value.join('\n'))

function choosePrivacy(level: string): void {
  if (isPrivacyLevelId(level)) setPrivacyLevel(level)
}

function saveTerms(): void {
  setPrivateTerms(termsText.value.split('\n'))
  termsText.value = privateTerms.value.join('\n')
}

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
          :level="privacyLevel"
          :levels="privacyLevels"
          :heading="t.privacyHeading"
          :running="t.privacyRunning"
          :summary="t.privacySummary"
          :lede="agentProvider || privacyLevelLocked ? undefined : t.privacyChoose"
          :state="agentProvider ? 'off' : 'on'"
          :off-title="t.privacyAgents"
          :off-text="t.privacyAgentsDetail"
          :selectable="!privacyLevelLocked && !agentProvider"
          @update:level="choosePrivacy"
        >
          <template #foot>
            <span v-if="privacyLevelLocked">{{ t.privacyAdmin }}</span>
            <label v-else class="flex w-full flex-col gap-1">
              <span class="font-medium text-surface">{{ t.privacyTerms }}</span>
              <AppTextarea v-model="termsText" :rows="2" @blur="saveTerms" />
              <span>{{ t.privacyTermsHint }}</span>
            </label>
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
            <span v-if="reviewModelReady">{{ t.crossCheckFoot }}</span>
            <span v-else class="flex flex-col items-start gap-1.5">
              <span>{{ t.crossCheckNoModelText }}</span>
              <AppButton color="primary" variant="link" @click="openSettingsDialog('ai')">
                {{ t.crossCheckChooseModel }}
              </AppButton>
            </span>
          </template>
        </CrossCheckSetting>
      </template>
    </ComposerStatus>
    <slot name="end" />
  </div>
</template>

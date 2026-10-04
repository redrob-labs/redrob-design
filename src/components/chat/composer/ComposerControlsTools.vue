<script setup lang="ts">
import ComposerMode from '@/components/ui/agent/ComposerMode.vue'
import ModelPicker from '@/components/ui/agent/ModelPicker.vue'
import { useEditorStore } from '@/app/editor/active-store'
import { assistantControlsFor } from '@/app/assistant/controls/store'

import { useComposerControls } from './useComposerControls'

/** Plan or Run, then the model picker, in the composer bar. */
const { compact = false } = defineProps<{ compact?: boolean }>()

const controls = assistantControlsFor(useEditorStore())

const { t, modeOptions, pickId, picks, here, source } = useComposerControls(controls)
</script>

<template>
  <ComposerMode
    v-model="controls.mode"
    :options="modeOptions"
    :label="t.modeLabel"
    :compact="compact"
  />
  <ModelPicker
    v-model="pickId"
    v-model:effort="controls.effort"
    :picks="[...picks]"
    :here="here"
    :label="t.modelLabel"
    :auto-label="t.auto"
    :auto-text="t.autoText"
    :heading="t.rankingHeading"
    :effort-label="t.effort"
    :away-label="(harness: string) => t.runsElsewhere({ harness })"
    :source="source"
  />
</template>

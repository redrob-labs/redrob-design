<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { ToggleGroupItem, ToggleGroupRoot } from 'reka-ui'

import Tip from '@/components/ui/Tip.vue'
import theme from '@/theme/agent/controls'

import type { ComposerModeOption, ComposerModeValue } from './types'

/** Plan or Run, in the composer bar beside the model picker. */
const {
  options,
  label,
  compact = false
} = defineProps<{
  options: ComposerModeOption[]
  label: string
  /** Icons only; labels stay for screen readers. */
  compact?: boolean
}>()

const model = defineModel<ComposerModeValue>({ required: true })
const styles = tv(theme)()

function select(value: unknown): void {
  if (value === 'plan' || value === 'run') model.value = value
}
</script>

<template>
  <ToggleGroupRoot
    type="single"
    :model-value="model"
    :aria-label="label"
    data-slot="composer-mode"
    :class="styles.mode()"
    @update:model-value="select"
  >
    <Tip v-for="option in options" :key="option.value" :label="option.hint ?? option.label">
      <ToggleGroupItem :value="option.value" :aria-label="option.label" :class="styles.modeItem()">
        <icon-lucide-route v-if="option.value === 'plan'" :class="styles.modeIcon()" />
        <icon-lucide-play v-else :class="styles.modeIcon()" />
        <span v-if="!compact">{{ option.label }}</span>
      </ToggleGroupItem>
    </Tip>
  </ToggleGroupRoot>
</template>

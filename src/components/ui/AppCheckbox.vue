<script setup lang="ts">
import { CheckboxIndicator, CheckboxRoot } from 'reka-ui'

const {
  modelValue = false,
  ariaLabel,
  disabled = false
} = defineProps<{
  modelValue?: boolean | 'indeterminate'
  ariaLabel: string
  disabled?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<template>
  <CheckboxRoot
    :model-value="modelValue"
    :aria-label="ariaLabel"
    :disabled="disabled"
    class="flex size-4 shrink-0 items-center justify-center rounded-xs border border-border-strong bg-input text-on-accent outline-none transition-colors data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=indeterminate]:border-accent data-[state=indeterminate]:bg-accent focus-visible:ring-2 focus-visible:ring-panel-focus focus-visible:ring-offset-1 focus-visible:ring-offset-panel disabled:opacity-50"
    @update:model-value="(value) => emit('update:modelValue', value === true)"
  >
    <CheckboxIndicator class="flex items-center justify-center">
      <icon-lucide-minus v-if="modelValue === 'indeterminate'" class="size-3" />
      <icon-lucide-check v-else class="size-3" />
    </CheckboxIndicator>
  </CheckboxRoot>
</template>

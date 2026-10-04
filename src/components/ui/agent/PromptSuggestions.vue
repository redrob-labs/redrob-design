<script setup lang="ts">
import { tv } from 'tailwind-variants'

import theme from '@/theme/agent/suggestions'

import type { PromptSuggestion } from './types'

/** A few things to try, after the design system's `PromptSuggestions`. */
const { items, label } = defineProps<{ items: PromptSuggestion[]; label: string }>()
const emit = defineEmits<{ select: [value: string, item: PromptSuggestion] }>()

const styles = tv(theme)()
</script>

<template>
  <div role="group" :aria-label="label" data-slot="prompt-suggestions" :class="styles.root()">
    <span :class="styles.label()">{{ label }}</span>
    <button
      v-for="item in items"
      :key="item.label"
      type="button"
      :class="styles.item()"
      @click="emit('select', item.value ?? item.label, item)"
    >
      {{ item.label }}
    </button>
  </div>
</template>

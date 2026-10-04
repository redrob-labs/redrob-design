<script setup lang="ts">
import { computed } from 'vue'
import { tv } from 'tailwind-variants'

import theme from '@/theme/agent/protection'

import ProtectionStatus from './ProtectionStatus.vue'
import type { MemoryScopeOption } from './types'

/** What Memory reads for this chat, after the design system's `MemoryScope`. */
const { options, label, onTitle, offTitle, offText, lede } = defineProps<{
  options: MemoryScopeOption[]
  label: string
  onTitle: string
  offTitle: string
  offText?: string
  lede?: string
}>()
defineSlots<{ foot?(): unknown }>()

const model = defineModel<string>({ required: true })
const styles = tv(theme)()
const selected = computed(() => options.find((option) => option.value === model.value))
</script>

<template>
  <div data-slot="memory-scope" :class="styles.panel()">
    <ProtectionStatus
      :heading="selected?.off ? offTitle : onTitle"
      :tone="selected?.off ? 'plain' : 'brand'"
    >
      <template #icon><icon-lucide-book-open class="size-4.5" /></template>
      {{ selected?.off ? offText : selected?.summary }}
    </ProtectionStatus>
    <p v-if="lede" :class="styles.lede()">{{ lede }}</p>
    <div role="radiogroup" :aria-label="label" :class="styles.options()">
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        role="radio"
        :aria-checked="model === option.value"
        :data-state="model === option.value ? 'on' : 'off'"
        :class="styles.option()"
        @click="model = option.value"
      >
        <span :data-state="model === option.value ? 'on' : 'off'" :class="styles.radio()">
          <span v-if="model === option.value" :class="styles.radioDot()" />
        </span>
        <span>
          <span :class="styles.optionLabel()">{{ option.label }}</span>
          <span v-if="option.detail" :class="styles.optionDetail()">{{ option.detail }}</span>
        </span>
      </button>
    </div>
    <div v-if="$slots.foot" :class="styles.foot()"><slot name="foot" /></div>
  </div>
</template>

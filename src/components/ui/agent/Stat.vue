<script lang="ts">
import type { ComponentUI } from '@/components/ui/types'
import type { StatTheme } from '@/theme/agent/stat'

export type StatUI = ComponentUI<StatTheme>

/** A labeled figure, after the design system's `Stat`. */
export interface StatProps {
  label: string
  value: string | number
  ui?: StatUI
}
</script>

<script setup lang="ts">
import { tv } from 'tailwind-variants'

import theme from '@/theme/agent/stat'

const { label, value, ui } = defineProps<StatProps>()
defineSlots<{ detail?(): unknown }>()

const styles = tv(theme)()
</script>

<template>
  <div data-slot="stat" :class="styles.root({ class: ui?.root })">
    <span :class="styles.label({ class: ui?.label })">{{ label }}</span>
    <span :class="styles.value({ class: ui?.value })">{{ value }}</span>
    <span v-if="$slots.detail" :class="styles.detail({ class: ui?.detail })">
      <slot name="detail" />
    </span>
  </div>
</template>

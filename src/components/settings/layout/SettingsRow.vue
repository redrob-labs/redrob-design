<script setup lang="ts">
import { tv } from 'tailwind-variants'

import theme from '@/theme/settings'

const { heading, description } = defineProps<{ heading: string; description?: string }>()

const styles = tv(theme)()
</script>

<template>
  <div :class="styles.row()">
    <span :class="styles.rowText()">
      <span :class="styles.rowTitle()">{{ heading }}</span>
      <span v-if="description" :class="styles.rowDescription()">{{ description }}</span>
    </span>
    <span :class="styles.rowControl()">
      <slot />
    </span>
  </div>
</template>

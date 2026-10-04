<script setup lang="ts">
import { tv } from 'tailwind-variants'

import theme from '@/theme/settings'

const styles = tv(theme)()
</script>

<template>
  <div>
    <h3 :class="styles.sectionTitle()"><slot /></h3>
    <p v-if="$slots.description" :class="styles.sectionDescription()">
      <slot name="description" />
    </p>
  </div>
</template>

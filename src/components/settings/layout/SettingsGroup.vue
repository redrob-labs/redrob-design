<script setup lang="ts">
import { tv } from 'tailwind-variants'

import theme from '@/theme/settings'

const { heading, description } = defineProps<{ heading?: string; description?: string }>()

const styles = tv(theme)()
</script>

<template>
  <section :class="styles.group()">
    <header v-if="heading || description" :class="styles.groupHeader()">
      <h4 v-if="heading" :class="styles.groupTitle()">{{ heading }}</h4>
      <p v-if="description" :class="styles.groupDescription()">{{ description }}</p>
    </header>
    <div :class="styles.groupBody()">
      <slot />
    </div>
  </section>
</template>

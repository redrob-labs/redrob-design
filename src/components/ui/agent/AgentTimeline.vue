<script setup lang="ts">
import { tv } from 'tailwind-variants'

import theme from '@/theme/agent/timeline'

import type { AgentStep } from './types'

/** One agent's steps in order, each a sentence, after the design system's `AgentTimeline`. */
const { steps, label } = defineProps<{ steps: AgentStep[]; label: string }>()

const styles = tv(theme)()
</script>

<template>
  <ol data-slot="agent-timeline" :aria-label="label" aria-live="polite" :class="styles.root()">
    <li v-for="step in steps" :key="step.id" :data-state="step.state" :class="styles.step()">
      <icon-lucide-check v-if="step.state === 'done'" :class="styles.icon()" />
      <icon-lucide-loader-circle v-else-if="step.state === 'active'" :class="styles.spinner()" />
      <icon-lucide-circle-alert v-else-if="step.state === 'error'" :class="styles.icon()" />
      <icon-lucide-circle v-else :class="styles.icon()" />
      <span>{{ step.label }}</span>
    </li>
  </ol>
</template>

<script setup lang="ts">
import { tv } from 'tailwind-variants'

import theme from '@/theme/agent/finding'

import type { FindingSeverity, FindingState } from './types'

/**
 * Something the machine flagged in a piece of work: how serious, where it
 * is, and what to do about it. A record that can be settled. After the
 * design system's `Finding`; `actions` is a slot.
 */
const {
  severity = 'medium',
  severityLabel,
  heading,
  where,
  detail,
  suggestion,
  suggestionLabel,
  state = 'open',
  stateLabel,
  openable = false
} = defineProps<{
  severity?: FindingSeverity
  severityLabel: string
  heading: string
  where?: string
  detail?: string
  suggestion?: string
  suggestionLabel?: string
  state?: FindingState
  /** Shown beside the heading once the finding is settled. */
  stateLabel?: string
  /** Makes `where` a button that shows the place. */
  openable?: boolean
}>()

const emit = defineEmits<{ open: [] }>()
const styles = tv(theme)()
</script>

<template>
  <article data-slot="finding" :data-state="state" :aria-label="heading" :class="styles.root()">
    <div :class="styles.head()">
      <span :data-severity="severity" :class="styles.severity()">
        <icon-lucide-octagon-alert v-if="severity === 'high'" :class="styles.severityIcon()" />
        <icon-lucide-triangle-alert
          v-else-if="severity === 'medium'"
          :class="styles.severityIcon()"
        />
        <icon-lucide-info v-else :class="styles.severityIcon()" />
        {{ severityLabel }}
      </span>
      <span :class="styles.heading()">{{ heading }}</span>
      <span v-if="state !== 'open' && stateLabel" :class="styles.state()">{{ stateLabel }}</span>
    </div>
    <template v-if="where">
      <button v-if="openable" type="button" :class="styles.where()" @click="emit('open')">
        <icon-lucide-map-pin :class="styles.whereIcon()" />
        {{ where }}
      </button>
      <span v-else :class="styles.whereStatic()">
        <icon-lucide-map-pin :class="styles.whereIcon()" />
        {{ where }}
      </span>
    </template>
    <p v-if="detail" :class="styles.detail()">{{ detail }}</p>
    <p v-if="suggestion" :class="styles.suggestion()">
      <span v-if="suggestionLabel" :class="styles.suggestionLabel()">{{ suggestionLabel }}</span>
      {{ suggestion }}
    </p>
    <div v-if="$slots.actions && state === 'open'" :class="styles.actions()">
      <slot name="actions" />
    </div>
  </article>
</template>

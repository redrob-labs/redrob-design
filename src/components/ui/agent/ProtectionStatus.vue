<script setup lang="ts">
import { computed } from 'vue'
import { tv } from 'tailwind-variants'

import theme from '@/theme/agent/protection'

import type { ProtectionTone } from './types'

/** A protection's state in a line: a card with a title and, when it runs here, a live light. */
const {
  heading,
  tone = 'plain',
  live
} = defineProps<{ heading: string; tone?: ProtectionTone; live?: string }>()
defineSlots<{ default?(): unknown; icon?(): unknown }>()

const styles = computed(() => tv(theme)({ tone }))
</script>

<template>
  <div data-slot="protection-status" :data-tone="tone" :class="styles.protection()">
    <span :class="styles.protectionIcon()">
      <slot name="icon"><icon-lucide-shield-check class="size-4.5" /></slot>
    </span>
    <div class="min-w-0 flex-1">
      <p :class="styles.protectionTitle()">{{ heading }}</p>
      <p v-if="$slots.default" :class="styles.protectionBody()"><slot /></p>
      <p v-if="live" :class="styles.protectionLive()">
        <span aria-hidden="true" :class="styles.liveDot()" />{{ live }}
      </p>
    </div>
  </div>
</template>

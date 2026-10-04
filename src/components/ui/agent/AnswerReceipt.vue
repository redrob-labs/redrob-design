<script setup lang="ts">
import { tv } from 'tailwind-variants'

import theme from '@/theme/agent/receipt'

import type { AnswerReceiptItem } from './types'

/**
 * One row under an answer: which AI answered and who chose it, what it cost,
 * what was kept private and what each check found. After the design system's
 * `AnswerReceipt`.
 */
const { items, label } = defineProps<{ items: AnswerReceiptItem[]; label: string }>()

const styles = tv(theme)()
</script>

<template>
  <ul data-slot="answer-receipt" :aria-label="label" :class="styles.root()">
    <li
      v-for="item in items"
      :key="item.id"
      :data-tone="item.tone ?? 'plain'"
      :class="styles.item()"
    >
      <icon-lucide-sparkles v-if="item.icon === 'auto'" :class="styles.icon()" />
      <icon-lucide-pin v-else-if="item.icon === 'pin'" :class="styles.icon()" />
      <icon-lucide-coins v-else-if="item.icon === 'price'" :class="styles.icon()" />
      <icon-lucide-shield-check v-else-if="item.icon === 'privacy'" :class="styles.icon()" />
      <icon-lucide-scan-search v-else-if="item.icon === 'check'" :class="styles.icon()" />
      <icon-lucide-book-open v-else :class="styles.icon()" />
      <span :class="styles.label()">{{ item.label }}</span>
      <span v-if="item.sub" :class="styles.sub()">{{ item.sub }}</span>
    </li>
  </ul>
</template>

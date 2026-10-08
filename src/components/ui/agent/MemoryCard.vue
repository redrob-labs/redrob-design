<script setup lang="ts">
/**
 * The Design Memory card in the thread: a few swatches, what it holds, and
 * Open. Store-free; the app passes the words and opens the drawer.
 */
const { swatches, heading, summary, openLabel } = defineProps<{
  swatches: string[]
  heading: string
  summary: string
  openLabel: string
}>()

const emit = defineEmits<{ open: [] }>()
</script>

<template>
  <button
    type="button"
    data-slot="memory-card"
    class="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-border bg-panel px-3 py-2.5 text-left transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-panel-focus focus-visible:outline-none"
    @click="emit('open')"
  >
    <span class="flex shrink-0 -space-x-1" aria-hidden="true">
      <span
        v-for="hex in swatches.slice(0, 7)"
        :key="hex"
        class="size-4 rounded-full border border-panel"
        :style="{ background: hex }"
      />
    </span>
    <span class="min-w-0 flex-1">
      <span class="block text-[13px] font-semibold text-surface">{{ heading }}</span>
      <span class="block truncate text-xs text-muted">{{ summary }}</span>
    </span>
    <span class="flex shrink-0 items-center gap-0.5 text-xs font-medium text-brand-ink">
      {{ openLabel }}
      <icon-lucide-chevron-right class="size-3.5" />
    </span>
  </button>
</template>

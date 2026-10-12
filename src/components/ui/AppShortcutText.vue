<script setup lang="ts">
/**
 * AppShortcutText — ported verbatim from PR #89 (src/components/ui/AppShortcutText.vue).
 * Renders a keyboard-shortcut hint in muted text; `ui.base` lets a caller extend
 * the classes via tailwind-merge.
 */
import { computed } from 'vue'
import { twMerge } from 'tailwind-merge'

const { ui } = defineProps<{
  ui?: {
    base?: string
  }
}>()

const cls = computed(() => twMerge('text-[11px] text-muted', ui?.base))
</script>

<template>
  <span :class="cls"><slot /></span>
</template>

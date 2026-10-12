<script setup lang="ts">
/**
 * AppPlaceholder — a centred empty-state with an optional icon slot and a label.
 * Trimmed stand-in for the app's shared placeholder; the `ui.root` prop lets a
 * caller stretch it to fill its container.
 */
defineProps<{
  label?: string
  ui?: { root?: string }
}>()
</script>

<template>
  <div
    :class="[
      'flex flex-col items-center justify-center gap-2 text-center text-muted',
      ui?.root
    ]"
  >
    <div class="text-muted"><slot name="icon" /></div>
    <p v-if="label" class="max-w-xs text-xs">{{ label }}</p>
  </div>
</template>

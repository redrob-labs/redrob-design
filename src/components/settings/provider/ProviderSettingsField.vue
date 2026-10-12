<script setup lang="ts">
/**
 * ProviderSettingsField — a labelled form row. Presentational stand-in for the
 * app's provider-settings field: a small label above a slotted control.
 */
defineProps<{ label: string }>()
</script>

<template>
  <div class="flex flex-col gap-1">
    <span class="text-[10px] font-medium text-muted">{{ label }}</span>
    <slot />
  </div>
</template>

<script setup lang="ts">
/**
 * Tab preparation indicator — adapted from PR #89
 * (src/components/preparation/tab/Indicator.vue).
 *
 * The original takes the editor's `EditorPreparationProgress` and derives a
 * percent via `preparationPercent()` — both backend. This slice takes the
 * already-derived `progress` (0–100, or null when indeterminate) directly, so
 * the spinner renders with no engine dependency. The accessible progressbar
 * markup is kept verbatim.
 */
const { progress = null } = defineProps<{
  progress?: number | null
}>()
</script>

<template>
  <span
    role="progressbar"
    :aria-valuenow="progress ?? undefined"
    :aria-valuemin="progress === null ? undefined : 0"
    :aria-valuemax="progress === null ? undefined : 100"
    aria-label="Preparing document"
    class="relative flex size-3 shrink-0 items-center justify-center text-accent"
  >
    <icon-lucide-loader-circle class="size-3 animate-spin" />
  </span>
</template>

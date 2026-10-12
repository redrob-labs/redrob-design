<script setup lang="ts" generic="T extends string">
/**
 * AppSelect — a labelled dropdown. Trimmed stand-in for the app's shared select,
 * carrying the surface the ported components use: a `label`, an `options` array
 * of `{ value, label }`, and a `v-model` bound value. A native `<select>` keeps
 * the slice dependency-light and fully accessible; the full app's version wraps
 * reka-ui's listbox for custom styling.
 */
const { label, options } = defineProps<{
  label?: string
  options: ReadonlyArray<{ value: T; label: string }>
}>()

const model = defineModel<T>({ required: true })
</script>

<template>
  <label class="flex flex-col gap-1">
    <span v-if="label" class="text-[10px] font-medium text-muted">{{ label }}</span>
    <select
      v-model="model"
      class="h-8 rounded border border-border bg-panel-field px-2 text-xs text-surface outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
  </label>
</template>

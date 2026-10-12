<script setup lang="ts">
/**
 * AppInput — the slice's text-input primitive. Trimmed stand-in for the app's
 * shared input, carrying the `size`/`placeholder`/`aria-label` surface the
 * ported components use, with a `v-model`. Themed through the semantic tokens.
 */
const { size = 'sm', placeholder } = defineProps<{
  size?: 'xs' | 'sm'
  placeholder?: string
}>()

const model = defineModel<string>({ default: '' })
</script>

<template>
  <input
    v-model="model"
    type="text"
    :placeholder="placeholder"
    :class="[
      'w-full rounded border border-border bg-input px-2.5 text-surface outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent',
      size === 'xs' ? 'h-6 text-[11px]' : 'h-8 text-xs'
    ]"
  />
</template>

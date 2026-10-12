<script setup lang="ts">
/**
 * ProviderSettingsKeyField — an API-key input. Presentational stand-in for the
 * app's key field: a password input with a label, an optional "get a key" link,
 * and a clear action when a key is already saved. The actual key never leaves
 * this slice (the save/clear calls are backend no-ops in the models stub).
 */
import ProviderSettingsField from './ProviderSettingsField.vue'

defineProps<{
  label: string
  saved?: boolean
  kind?: string
  placeholder?: string
  keyURL?: string
  keyURLLabel?: string
}>()
const emit = defineEmits<{ clear: [] }>()
const model = defineModel<string>({ default: '' })
</script>

<template>
  <ProviderSettingsField :label="label">
    <div class="flex items-center gap-2">
      <input
        v-model="model"
        type="password"
        :placeholder="placeholder"
        :aria-label="label"
        class="h-8 w-full rounded border border-border bg-input px-2.5 text-xs text-surface outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
      />
      <button
        v-if="saved"
        type="button"
        class="shrink-0 rounded px-2 py-1 text-[11px] text-muted hover:bg-hover hover:text-surface"
        @click="emit('clear')"
      >
        Clear
      </button>
    </div>
    <a
      v-if="keyURL"
      :href="keyURL"
      target="_blank"
      rel="noopener noreferrer"
      class="mt-1 inline-block text-[10px] text-accent hover:underline"
    >
      {{ keyURLLabel }}
    </a>
  </ProviderSettingsField>
</template>

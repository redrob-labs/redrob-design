<script setup lang="ts">
/**
 * ProviderSelect — picks the AI provider (or ACP agent) a model profile uses.
 * Presentational stand-in for the app's custom provider picker: a native select
 * over the catalogue from the core-constants stub, with a `model-value` + an
 * `update:model-value` event. The `ui` prop mirrors the app's styling hook.
 */
import { AI_PROVIDERS, ACP_AGENTS } from '@redrob-design/core/constants'

defineProps<{
  modelValue: string
  ui?: { trigger?: string; item?: string }
}>()
const emit = defineEmits<{ 'update:model-value': [value: string] }>()
</script>

<template>
  <select
    :value="modelValue"
    class="h-8 w-full rounded border border-border bg-input px-2.5 text-xs text-surface outline-none focus-visible:ring-2 focus-visible:ring-accent"
    @change="emit('update:model-value', ($event.target as HTMLSelectElement).value)"
  >
    <optgroup label="Providers">
      <option v-for="provider in AI_PROVIDERS" :key="provider.id" :value="provider.id">
        {{ provider.name }}
      </option>
    </optgroup>
    <optgroup label="Agents">
      <option v-for="agent in ACP_AGENTS" :key="agent.id" :value="`acp:${agent.id}`">
        {{ agent.name }}
      </option>
    </optgroup>
  </select>
</template>

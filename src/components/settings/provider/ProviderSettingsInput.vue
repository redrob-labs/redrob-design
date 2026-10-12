<script setup lang="ts">
/**
 * ProviderSettingsInput — a plain text input for a provider setting
 * (base URL, custom model id, reasoning effort). Presentational stand-in for the
 * app's provider input; a thin wrapper over AppInput with a `v-model`.
 */
import AppInput from '@/components/ui/AppInput.vue'

defineProps<{ placeholder?: string }>()
const model = defineModel<string>({ default: '' })
</script>

<template>
  <AppInput v-model="model" size="sm" :placeholder="placeholder" />
</template>

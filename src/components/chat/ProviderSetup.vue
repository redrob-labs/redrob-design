<script setup lang="ts">
/**
 * ProviderSetup — the "connect a model to start" state shown when no AI model is
 * configured. Presentational stand-in for the app's setup flow (which opens the
 * models settings and runs connection tests). The skeleton shows the prompt and
 * a button; wiring it to real settings is a one-line change against the app.
 */
import AppButton from '@/components/ui/AppButton.vue'
import AppPlaceholder from '@/components/ui/AppPlaceholder.vue'
</script>

<template>
  <AppPlaceholder
    label="Connect a model to start chatting."
    :ui="{ root: 'h-full gap-3 p-6' }"
    data-test-id="chat-provider-setup"
  >
    <template #icon>
      <icon-lucide-plug class="size-5" />
    </template>
    <AppButton size="sm" color="accent">Add a model</AppButton>
  </AppPlaceholder>
</template>

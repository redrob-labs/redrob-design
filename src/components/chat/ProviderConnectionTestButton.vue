<script setup lang="ts">
/**
 * ProviderConnectionTestButton — "Test connection" affordance. Presentational
 * stand-in for the app's button: reflects an idle/testing/success/error status
 * and emits `test`. The actual probe is a backend no-op in this slice.
 */
export type ProviderConnectionTestFailureReason = string

defineProps<{
  status: 'idle' | 'testing' | 'success' | 'error'
  reason?: ProviderConnectionTestFailureReason | null
  disabled?: boolean
}>()
const emit = defineEmits<{ test: [] }>()
</script>

<template>
  <div class="flex flex-col gap-1">
    <button
      type="button"
      class="w-fit rounded border border-border px-2.5 py-1.5 text-[11px] text-surface hover:bg-hover disabled:opacity-50"
      :disabled="disabled || status === 'testing'"
      @click="emit('test')"
    >
      {{ status === 'testing' ? 'Testing…' : 'Test connection' }}
    </button>
    <p v-if="status === 'success'" class="text-[10px] text-[var(--color-success)]">
      Connection OK
    </p>
    <p v-else-if="status === 'error'" class="text-[10px] text-danger">
      {{ reason ?? 'Connection failed' }}
    </p>
  </div>
</template>

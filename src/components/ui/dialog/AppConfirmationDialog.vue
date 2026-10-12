<script setup lang="ts">
/**
 * AppConfirmationDialog — a confirm/cancel modal (e.g. "Delete model?").
 * Trimmed stand-in for the app's shared confirmation dialog, built on
 * AppDialogRoot. Carries the heading/description/labels and a `tone` so a
 * destructive action reads in the danger colour. Emits `confirm` on accept.
 */
import AppDialogRoot from './AppDialogRoot.vue'
import AppDialogHeader from './AppDialogHeader.vue'
import AppDialogBody from './AppDialogBody.vue'

const { tone = 'default' } = defineProps<{
  heading: string
  description?: string
  cancelLabel?: string
  confirmLabel?: string
  tone?: 'default' | 'danger'
}>()
const emit = defineEmits<{ confirm: [] }>()
const open = defineModel<boolean>('open', { default: false })

function confirm(): void {
  emit('confirm')
  open.value = false
}
</script>

<template>
  <AppDialogRoot v-model:open="open" size="md">
    <AppDialogHeader :heading="heading" :description="description" :close-label="cancelLabel" />
    <AppDialogBody>
      <div class="flex items-center justify-end gap-2">
        <button
          type="button"
          class="rounded px-2.5 py-1.5 text-[11px] text-muted hover:bg-hover hover:text-surface"
          @click="open = false"
        >
          {{ cancelLabel }}
        </button>
        <button
          type="button"
          :class="[
            'rounded px-3 py-1.5 text-[11px] font-medium text-on-accent',
            tone === 'danger' ? 'bg-error hover:opacity-90' : 'bg-accent hover:bg-accent-hover'
          ]"
          @click="confirm"
        >
          {{ confirmLabel }}
        </button>
      </div>
    </AppDialogBody>
  </AppDialogRoot>
</template>

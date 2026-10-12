<script setup lang="ts">
/**
 * ChatInput — the message composer. Presentational stand-in for the app's
 * ChatInput, which handles attachments, node references, vision and streaming
 * status. The skeleton keeps the composer layout — a growing textarea with a
 * send/stop button — and emits `submit` with the typed text.
 */
import { ref } from 'vue'
import { useI18n } from '@redrob-design/vue'

const { status = 'ready', disabled = false } = defineProps<{
  status?: 'ready' | 'submitted' | 'streaming' | 'error'
  disabled?: boolean
}>()
const emit = defineEmits<{
  submit: [payload: { modelText: string; displayText: string; images: never[]; nodes: never[] }]
  stop: []
}>()

const { ai } = useI18n()
const text = ref('')
const busy = () => status === 'submitted' || status === 'streaming'

function send(): void {
  const value = text.value.trim()
  if (!value || disabled) return
  emit('submit', { modelText: value, displayText: value, images: [], nodes: [] })
  text.value = ''
}
</script>

<template>
  <div class="flex shrink-0 items-end gap-2 border-t border-border p-3">
    <textarea
      v-model="text"
      rows="1"
      :placeholder="ai.describeCreateOrChange"
      class="min-h-9 flex-1 resize-none rounded border border-border bg-input px-2.5 py-2 text-xs text-surface outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
      @keydown.enter.exact.prevent="send"
    />
    <button
      v-if="busy()"
      type="button"
      class="flex size-9 shrink-0 items-center justify-center rounded bg-panel-field text-surface hover:bg-panel-field-hover"
      aria-label="Stop"
      @click="emit('stop')"
    >
      <icon-lucide-square class="size-3.5" />
    </button>
    <button
      v-else
      type="button"
      class="flex size-9 shrink-0 items-center justify-center rounded bg-accent text-on-accent hover:bg-accent-hover disabled:opacity-50"
      aria-label="Send"
      :disabled="disabled || !text.trim()"
      @click="send"
    >
      <icon-lucide-arrow-up class="size-3.5" />
    </button>
  </div>
</template>

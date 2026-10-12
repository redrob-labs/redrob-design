<script setup lang="ts">
/**
 * ChatMessage — a single chat bubble. Presentational stand-in for the app's
 * ChatMessage, which renders rich streamed AI-SDK message parts (tool calls,
 * attachments, change-sets). The skeleton renders the role and plain text so the
 * ChatPanel layout reads correctly without the streaming engine.
 */
export interface SkeletonMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
}

defineProps<{
  message: SkeletonMessage
  streaming?: boolean
}>()
</script>

<template>
  <div
    class="flex flex-col gap-1"
    :class="message.role === 'user' ? 'items-end' : 'items-start'"
    :data-role="message.role"
  >
    <div
      class="max-w-[85%] rounded-lg px-3 py-2 text-xs"
      :class="
        message.role === 'user'
          ? 'bg-accent text-on-accent'
          : 'bg-panel-field text-surface'
      "
    >
      {{ message.text }}<span v-if="streaming" class="animate-pulse">▍</span>
    </div>
  </div>
</template>

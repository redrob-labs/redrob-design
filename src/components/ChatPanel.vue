<script setup lang="ts">
/**
 * ChatPanel — the assistant chat surface.
 *
 * The PR #89 ChatPanel is ~90% AI-engine wiring: a `@ai-sdk/vue` streaming
 * `Chat`, the submission pipeline, ACP transport, ship/cross-check/opening-review
 * composables, tool-log and change-set stores, and seven engine-coupled
 * sub-components. None of that is UI/UX, and reproducing it would mean authoring
 * a fake chat engine. Per the agreed Option B, this is a PRESENTATIONAL SKELETON:
 * it preserves the panel's real layout and interaction shape — the unconfigured
 * provider-setup state, the scrollable message list with its empty placeholder,
 * the dev/clear toolbar, and the composer — over a tiny in-component message
 * model. Sending echoes a placeholder assistant reply so the flow is visible;
 * no network, no engine. To reconnect, swap the local state for `useAIChat()` +
 * `useChatSubmission()`; the markup below mirrors the original.
 */
import { computed, nextTick, ref } from 'vue'
import { ScrollAreaRoot, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport } from 'reka-ui'
import { useI18n, useThreadMessages } from '@redrob-design/vue'

import ChatInput from '@/components/chat/ChatInput.vue'
import ChatMessage, { type SkeletonMessage } from '@/components/chat/ChatMessage.vue'
import ProviderSetup from '@/components/chat/ProviderSetup.vue'
import AppPlaceholder from '@/components/ui/AppPlaceholder.vue'
import AppButton from '@/components/ui/AppButton.vue'

/** Toggle to preview the unconfigured provider-setup state in the showcase. */
const { configured = true } = defineProps<{ configured?: boolean }>()

const { ai } = useI18n()
const thread = useThreadMessages()

const messages = ref<SkeletonMessage[]>([])
const messagesEnd = ref<HTMLDivElement>()
let counter = 0

function scrollToBottom(): void {
  nextTick(() => messagesEnd.value?.scrollIntoView({ behavior: 'smooth', block: 'end' }))
}

function submit(payload: { displayText: string }): void {
  counter += 1
  messages.value.push({ id: `u-${counter}`, role: 'user', text: payload.displayText })
  // Skeleton: a placeholder reply stands in for the streamed assistant turn.
  messages.value.push({
    id: `a-${counter}`,
    role: 'assistant',
    text: 'This is a presentation-only build — the AI engine is not wired in.'
  })
  scrollToBottom()
}

function clearChat(): void {
  messages.value = []
}

const status = computed<'ready'>(() => 'ready')
</script>

<template>
  <div data-test-id="chat-panel" class="flex min-w-0 flex-1 flex-col overflow-hidden select-text">
    <ProviderSetup v-if="!configured" />

    <template v-else>
      <ScrollAreaRoot class="min-h-0 flex-1">
        <ScrollAreaViewport class="h-full px-3 py-3 [&>div]:h-full">
          <AppPlaceholder
            v-if="messages.length === 0"
            data-test-id="chat-empty-state"
            :label="ai.describeCreateOrChange"
            :ui="{ root: 'h-full' }"
          >
            <template #icon>
              <icon-lucide-message-circle class="size-5" />
            </template>
          </AppPlaceholder>

          <div v-else data-test-id="chat-messages" class="flex flex-col gap-3">
            <ChatMessage v-for="msg in messages" :key="msg.id" :message="msg" />
            <div ref="messagesEnd" />
          </div>
        </ScrollAreaViewport>
        <ScrollAreaScrollbar orientation="vertical" class="flex w-1.5 touch-none p-px select-none">
          <ScrollAreaThumb class="relative flex-1 rounded-full bg-muted/30" />
        </ScrollAreaScrollbar>
      </ScrollAreaRoot>

      <div
        v-if="messages.length > 0"
        class="flex shrink-0 items-center gap-1 border-t border-border px-3 py-1"
      >
        <AppButton color="error" variant="ghost" size="xs" @click="clearChat">
          <icon-lucide-trash-2 class="size-3" />
          {{ thread.clearThread }}
        </AppButton>
      </div>

      <ChatInput :status="status" @submit="submit" />
    </template>
  </div>
</template>

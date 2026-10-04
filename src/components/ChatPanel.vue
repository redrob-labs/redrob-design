<script setup lang="ts">
import { ScrollAreaRoot, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport } from 'reka-ui'
import { refAutoReset, useClipboard } from '@vueuse/core'
import { computed, markRaw, shallowRef, nextTick, ref, watch } from 'vue'

import { getACPDebugText, clearACPDebugLog, hasACPDebugEntries } from '@/app/ai/acp/transport'
import { copyChatLog } from '@/app/ai/debug'
import { clearVisibleMessageText } from '@/app/ai/chat/presentation'
import { useChatSubmission } from '@/app/ai/chat/submission/use'
import { takePendingBrief } from '@/app/home/brief'
import { forgetChangeSets } from '@/app/assistant/changes/store'
import { clearMessageAttachments } from '@/app/ai/attachment/presentation/store'
import { clearToolLogEntries, didHitStepLimit } from '@/app/ai/tools'
import { activeTab } from '@/app/tabs'
import { getActiveEditorStore } from '@/app/editor/active-store'
import ACPPermissionDialog from '@/components/chat/ACPPermissionDialog.vue'
import ChatInput from '@/components/chat/ChatInput.vue'
import ChatMessage from '@/components/chat/ChatMessage.vue'
import AppPlaceholder from '@/components/ui/AppPlaceholder.vue'
import AppButton from '@/components/ui/AppButton.vue'
import ProviderSetup from '@/components/chat/ProviderSetup.vue'
import { useAIChat } from '@/app/ai/chat/use'
import { toast } from '@/app/shell/ui'
import { openSettingsDialog } from '@/app/settings/dialog'
import { useI18n, useThreadMessages, vTestId } from '@redrob-design/vue'
import { turnSteps } from '@/components/chat/timeline/steps'
import { useOpeningReview } from '@/components/chat/review/useOpeningReview'
import { provideChatSend } from '@/components/chat/submit'
import AgentTimeline from '@/components/ui/agent/AgentTimeline.vue'

import { useNotificationMessages } from '@/app/i18n/notifications'

import type { Chat } from '@ai-sdk/vue'
import type { UIMessage } from 'ai'
import type { JSONObject } from '@redrob-design/scene-graph/primitives'

const IS_DEV = import.meta.env.DEV

const { isConfigured, ensureChat, resetChat, chatFailure, clearChatFailure } = useAIChat()
const { copy } = useClipboard()
const { ai } = useI18n()
const thread = useThreadMessages()
const notifications = useNotificationMessages()

const chat = shallowRef<Chat<UIMessage> | null>(null)
useOpeningReview(chat)
const submission = useChatSubmission({
  chat,
  ensureChat,
  clearFailure: clearChatFailure,
  getEditor: getActiveEditorStore,
  messages: computed(() => ({
    openSettings: ai.value.openProviderSettingsAction,
    requestFailed: ai.value.chatRequestFailed,
    visionUnavailable: ai.value.visionModelUnavailable
  })),
  reportError: toast.error,
  openModelSettings: () => openSettingsDialog('ai')
})

// Cards in the thread (Plan's questions, directions) answer as the person.
provideChatSend((text) => {
  void submission.submit({ modelText: text, displayText: text, images: [], nodes: [] })
})

/** Sends the brief a new file was started with on Home, once the chat can take it. */
function sendPendingBrief(): void {
  if (!isConfigured.value || !chat.value) return
  const brief = takePendingBrief(getActiveEditorStore())
  if (brief) void submission.submit(brief)
}

void ensureChat()
  .then((c) => {
    if (c) chat.value = markRaw(c)
    sendPendingBrief()
    return undefined
  })
  .catch((error: unknown) => {
    toast.error(
      notifications.value.chatInitializationFailed({
        error: error instanceof Error ? error.message : String(error)
      })
    )
  })
const messagesEnd = ref<HTMLDivElement>()
const debugCopied = refAutoReset(false, 1500)
const acpLogCopied = refAutoReset(false, 1500)

const messages = computed(() => chat.value?.messages ?? [])
const failureMessage = computed(() => {
  switch (chatFailure.value?.reason) {
    case 'authentication':
      return ai.value.chatAuthenticationFailed
    case 'forbidden':
      return ai.value.chatForbidden
    case 'insufficient-credit':
      return ai.value.chatInsufficientCredit
    case 'model-not-found':
      return ai.value.chatModelNotFound
    case 'network':
      return ai.value.chatNetworkFailed
    case 'output-limit':
      return ai.value.chatOutputLimit
    case 'rate-limit':
      return ai.value.chatRateLimited
    case 'request-failed':
      return ai.value.chatRequestFailed
    default:
      return null
  }
})
const failureHasSettingsAction = computed(() =>
  ['authentication', 'forbidden', 'model-not-found'].includes(chatFailure.value?.reason ?? '')
)
const status = computed(() => chat.value?.status ?? 'ready')
function isStreamingMessage(message: UIMessage, index: number): boolean {
  return (
    message.role === 'assistant' &&
    index === messages.value.length - 1 &&
    (status.value === 'submitted' || status.value === 'streaming')
  )
}
const isThinking = computed(() => {
  const s = status.value
  if (s !== 'submitted' && s !== 'streaming') return false
  if (messages.value.length === 0) return true
  const last = messages.value[messages.value.length - 1]
  if (last.role !== 'assistant') return true
  const parts = last.parts
  if (parts.length === 0) return true
  const lastPart = parts[parts.length - 1] as JSONObject
  if (lastPart.type === 'step-start') return true
  if ('toolCallId' in lastPart && lastPart.state === 'output-available') return true
  if ('toolCallId' in lastPart && lastPart.state === 'output-error') return true
  return s === 'submitted'
})

const progressSteps = computed(() => {
  const last = messages.value.at(-1)
  const answer = last?.role === 'assistant' ? last : null
  return turnSteps(answer, {
    stepReading: thread.value.stepReading,
    stepWorking: thread.value.stepWorking,
    stepAnswering: thread.value.stepAnswering,
    stepTool: (tool) => thread.value.stepTool({ tool })
  })
})

const showContinue = computed(() => {
  if (status.value !== 'ready') return false
  if (messages.value.length === 0) return false
  const last = messages.value[messages.value.length - 1]
  return last.role === 'assistant' && didHitStepLimit()
})

function scrollToBottom() {
  nextTick(() => {
    messagesEnd.value?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  })
}

watch(messages, scrollToBottom, { deep: true })
watch(
  () => chatFailure.value?.reason,
  (reason) => {
    if (!reason) return
    toast.error(
      failureMessage.value ?? ai.value.chatRequestFailed,
      failureHasSettingsAction.value
        ? {
            label: ai.value.openProviderSettingsAction,
            run: () => openSettingsDialog('ai')
          }
        : undefined
    )
  }
)
watch(
  () => activeTab.value?.id,
  async () => {
    submission.cancel()
    clearMessageAttachments()
    clearVisibleMessageText()
    const nextChat = await ensureChat()
    chat.value = nextChat ? markRaw(nextChat) : null
    sendPendingBrief()
  }
)
watch(isConfigured, async (configured) => {
  if (!configured) return
  const nextChat = await ensureChat()
  chat.value = nextChat ? markRaw(nextChat) : null
  sendPendingBrief()
})

function handleStop() {
  submission.stop()
}

async function handleCopyDebug() {
  await copyChatLog(messages.value, chatFailure.value)
  debugCopied.value = true
}

async function handleCopyACPLog() {
  const text = getACPDebugText()
  if (!text) return
  await copy(text)
  acpLogCopied.value = true
}

function handleClearChat() {
  submission.cancel()
  clearChatFailure()
  clearMessageAttachments()
  clearVisibleMessageText()
  chat.value = null
  void resetChat().catch((error: unknown) => {
    console.error('Chat reset error:', error)
  })
  clearToolLogEntries()
  forgetChangeSets(getActiveEditorStore())
  clearACPDebugLog()
}
</script>

<template>
  <div data-test-id="chat-panel" class="flex min-w-0 flex-1 flex-col overflow-hidden select-text">
    <ProviderSetup v-if="!isConfigured" />

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

          <!-- Messages -->
          <div v-else data-test-id="chat-messages" class="flex flex-col gap-3">
            <ChatMessage
              v-for="(msg, index) in messages"
              :key="msg.id"
              :message="msg"
              :streaming="isStreamingMessage(msg, index)"
            />

            <!-- Thinking indicator: shown when AI is working but no visible activity -->
            <AgentTimeline
              v-if="isThinking"
              v-test-id="'chat-typing-indicator'"
              :steps="progressSteps"
              :label="thread.progressLabel"
            />

            <!-- Continue button when step limit reached -->
            <div v-if="showContinue" class="flex justify-center py-2">
              <button
                class="flex items-center gap-1.5 rounded-full bg-accent/10 px-4 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
                @click="
                  submission.submit({
                    modelText: 'Continue where you left off',
                    displayText: 'Continue where you left off',
                    images: [],
                    nodes: []
                  })
                "
              >
                <icon-lucide-play class="size-3" />
                Continue
              </button>
            </div>

            <div ref="messagesEnd" />
          </div>
        </ScrollAreaViewport>
        <ScrollAreaScrollbar orientation="vertical" class="flex w-1.5 touch-none p-px select-none">
          <ScrollAreaThumb class="relative flex-1 rounded-full bg-muted/30" />
        </ScrollAreaScrollbar>
      </ScrollAreaRoot>

      <!-- Chat toolbar -->
      <div
        v-if="messages.length > 0"
        class="flex shrink-0 items-center gap-1 border-t border-border px-3 py-1"
      >
        <AppButton v-if="IS_DEV" color="neutral" variant="ghost" size="xs" @click="handleCopyDebug">
          <icon-lucide-clipboard-copy v-if="!debugCopied" class="size-3" />
          <icon-lucide-check v-else class="size-3 text-success" />
          {{ debugCopied ? 'Copied' : 'Copy log' }}
        </AppButton>
        <AppButton
          v-if="IS_DEV && hasACPDebugEntries()"
          color="neutral"
          variant="ghost"
          size="xs"
          @click="handleCopyACPLog"
        >
          <icon-lucide-bug v-if="!acpLogCopied" class="size-3" />
          <icon-lucide-check v-else class="size-3 text-success" />
          {{ acpLogCopied ? 'Copied' : 'ACP log' }}
        </AppButton>
        <AppButton color="error" variant="ghost" size="xs" @click="handleClearChat">
          <icon-lucide-trash-2 class="size-3" />
          Clear
        </AppButton>
      </div>

      <ChatInput
        :status="status"
        :disabled="submission.busy.value"
        @submit="submission.submit"
        @stop="handleStop"
        @error="toast.error"
      />

      <ACPPermissionDialog />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { refAutoReset, useClipboard } from '@vueuse/core'
import { isReasoningUIPart, isTextUIPart, isToolUIPart, getToolName } from 'ai'
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'
import { useI18n, useThreadMessages, vTestId } from '@redrob-design/vue'

import { attachmentsForMessage } from '@/app/ai/attachment/presentation/store'
import { visibleUserMessageText } from '@/app/ai/chat/presentation'
import AttachmentList from '@/components/chat/attachment/AttachmentList.vue'
import TurnChanges from '@/components/chat/changes/TurnChanges.vue'
import ChatMarkdown from '@/components/chat/ChatMarkdown.vue'
import ReasoningBlock from '@/components/chat/ReasoningBlock.vue'
import IconButton from '@/components/ui/IconButton.vue'
import AnswerReceipt from '@/components/ui/agent/AnswerReceipt.vue'
import { receiptFor } from '@/app/assistant/thread/store'
import { receiptItems } from './receipt/items'
import { classifyToolState } from './tool-state'

import type { UIDataTypes, UIMessage, UIMessagePart, UITools } from 'ai'

const { message, streaming = false } = defineProps<{
  message: UIMessage
  streaming?: boolean
}>()
const { ai, locale } = useI18n()
const thread = useThreadMessages()
const receipt = computed(() => {
  if (streaming || message.role !== 'assistant') return []
  const turn = receiptFor(message.id)
  if (!turn) return []
  return receiptItems(
    turn,
    {
      byAuto: thread.value.byAuto,
      yourChoice: thread.value.yourChoice,
      free: thread.value.free,
      priceUnknown: thread.value.priceUnknown,
      private: thread.value.private,
      keptPrivate: (count) => thread.value.keptPrivate({ count }),
      factCheck: thread.value.factCheck
    },
    locale.value
  )
})
const markdownMode = computed(() => (streaming ? 'streaming' : 'static'))
const attachments = attachmentsForMessage(message.id)
const assistantText = computed(() =>
  message.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join('')
)
const firstAssistantTextPartIndex = computed(() =>
  message.parts.findIndex((part) => isTextUIPart(part) && part.text.length > 0)
)
const copied = refAutoReset(false, 1500)
const { copy, isSupported: clipboardSupported } = useClipboard()

async function copyResponse(): Promise<void> {
  if (!assistantText.value || !clipboardSupported.value) return
  await copy(assistantText.value)
  copied.value = true
}

type ToolPart = Extract<UIMessagePart<UIDataTypes, UITools>, { toolCallId: string }>

function toolDisplayName(part: ToolPart): string {
  return getToolName(part)
    .replace(/^mcp__[^_]+__/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function hasErrorOutput(part: ToolPart): boolean {
  return (
    part.state === 'output-available' &&
    typeof part.output === 'object' &&
    part.output !== null &&
    'error' in part.output
  )
}

function toolState(part: ToolPart): 'pending' | 'done' | 'error' {
  return classifyToolState({
    toolName: getToolName(part),
    state: part.state,
    output: part.output
  })
}

function partKey(part: UIMessagePart<UIDataTypes, UITools>, index: number): string {
  if ('toolCallId' in part) return part.toolCallId
  return `part-${index}`
}
</script>

<template>
  <div
    v-test-id="`chat-message-${message.role}`"
    :class="message.role === 'user' ? 'flex justify-end' : ''"
  >
    <div
      class="min-w-0 space-y-2 select-text"
      :class="message.role === 'user' ? 'max-w-[85%]' : ''"
    >
      <template v-if="message.role === 'assistant'">
        <template v-for="(part, i) in message.parts" :key="partKey(part, i)">
          <!-- Reasoning -->
          <ReasoningBlock
            v-if="isReasoningUIPart(part) && part.text"
            :text="part.text"
            :streaming="part.state === 'streaming'"
            :thinking-label="ai.thinking"
            :reasoning-label="ai.reasoning"
          />

          <!-- Tool call -->
          <div v-if="isToolUIPart(part)" class="rounded-lg border border-ai-border bg-ai p-2">
            <CollapsibleRoot>
              <CollapsibleTrigger
                class="flex w-full items-center gap-2 rounded px-1 py-0.5 hover:bg-hover"
              >
                <div
                  class="flex size-4 items-center justify-center rounded-full"
                  :class="{
                    'bg-accent/20 text-accent': toolState(part) === 'pending',
                    'bg-success/15 text-success': toolState(part) === 'done',
                    'bg-error-bg text-error': toolState(part) === 'error'
                  }"
                >
                  <icon-lucide-loader-circle
                    v-if="toolState(part) === 'pending'"
                    class="size-3 animate-spin"
                  />
                  <icon-lucide-check v-else-if="toolState(part) === 'done'" class="size-3" />
                  <icon-lucide-triangle-alert v-else class="size-3" />
                </div>
                <span class="text-[11px] text-surface">
                  {{ toolDisplayName(part) }}
                </span>
                <span class="text-[10px] text-muted">
                  {{
                    toolState(part) === 'pending'
                      ? ai.toolRunning
                      : toolState(part) === 'done'
                        ? ai.toolFinished
                        : ai.toolError
                  }}
                </span>
                <icon-lucide-chevron-down
                  v-if="toolState(part) !== 'pending'"
                  class="ml-auto size-3 text-muted transition-transform [[data-state=open]>&]:rotate-180"
                />
              </CollapsibleTrigger>
              <CollapsibleContent
                v-if="toolState(part) !== 'pending'"
                class="data-[state=closed]:collapsible-up data-[state=open]:collapsible-down overflow-hidden text-[10px]"
              >
                <pre class="mt-1 overflow-x-auto rounded bg-input p-2 text-muted">{{
                  part.state === 'output-error' && part.errorText
                    ? part.errorText
                    : hasErrorOutput(part)
                      ? (part.output as { error: string }).error
                      : JSON.stringify(part.output, null, 2)
                }}</pre>
              </CollapsibleContent>
            </CollapsibleRoot>
          </div>

          <!-- Text -->
          <div
            v-else-if="isTextUIPart(part) && part.text"
            data-test-id="chat-text-bubble"
            class="group/response relative rounded-xl rounded-tl-md border border-ai-border bg-ai px-3 py-2 text-xs leading-relaxed text-surface"
          >
            <ChatMarkdown :content="part.text" :mode="markdownMode" />
            <IconButton
              v-if="i === firstAssistantTextPartIndex && assistantText && clipboardSupported"
              :label="copied ? ai.responseCopied : ai.copyResponse"
              size="xs"
              data-slot="chat-copy-response"
              class="absolute right-1 bottom-1 opacity-0 focus-visible:opacity-100 group-hover/response:opacity-100"
              @click="copyResponse"
            >
              <icon-lucide-check v-if="copied" class="size-3 text-success" />
              <icon-lucide-copy v-else class="size-3" />
            </IconButton>
          </div>
        </template>
        <TurnChanges v-if="!streaming" :message-id="message.id" />
        <AnswerReceipt v-if="receipt.length" :items="receipt" :label="thread.receiptLabel" />
      </template>

      <!-- User message -->
      <template v-else-if="message.role === 'user'">
        <AttachmentList v-if="attachments.length" :attachments="attachments" />
        <div
          data-test-id="chat-text-bubble"
          class="rounded-xl rounded-br-md bg-accent px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap text-on-accent"
        >
          {{
            visibleUserMessageText(
              message.id,
              message.parts
                .filter(isTextUIPart)
                .map((p) => p.text)
                .join('')
            )
          }}
        </div>
      </template>
    </div>
  </div>
</template>

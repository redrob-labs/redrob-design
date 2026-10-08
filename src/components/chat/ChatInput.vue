<script setup lang="ts">
import { TooltipProvider } from 'reka-ui'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'

import { useComposerMessages, useI18n, useSelectionState } from '@redrob-design/vue'
import { ACP_AGENTS } from '@redrob-design/core/constants'

import ChatNodePreview from '@/components/chat/ChatNodePreview.vue'
import ChatProfileSelect from '@/components/chat/ChatProfileSelect.vue'
import ComposerControlsStatus from '@/components/chat/composer/ComposerControlsStatus.vue'
import ComposerControlsTools from '@/components/chat/composer/ComposerControlsTools.vue'
import { useAttachmentDrafts } from '@/components/chat/input/useAttachments'
import Composer from '@/components/ui/agent/Composer.vue'
import IconButton from '@/components/ui/IconButton.vue'
import { MAX_IMAGE_ATTACHMENTS } from '@/app/ai/attachment/image/types'
import type { ChatSubmission } from '@/app/ai/chat/submission/types'
import { composerFocusRequest } from '@/app/ai/chat/ask'
import { pointRequest } from '@/app/assistant/pointing/store'
import { useAIChat } from '@/app/ai/chat/use'
import { designModelProfile } from '@/app/ai/models'
import { openSettingsDialog } from '@/app/settings/dialog'

const { providerID, providerDef, modelID, customModelID } = useAIChat()
const { editor, selectedIds } = useSelectionState()
const { ai } = useI18n()
const composerText = useComposerMessages()

const { status, disabled = false } = defineProps<{
  status: 'ready' | 'submitted' | 'streaming' | 'error'
  disabled?: boolean
}>()

const emit = defineEmits<{
  submit: [submission: ChatSubmission]
  stop: []
  error: [message: string]
}>()

const composer = useTemplateRef<{ focus: () => void }>('composer')
const input = ref('')

watch(composerFocusRequest, async () => {
  await nextTick()
  composer.value?.focus()
})

const attachments = useAttachmentDrafts({
  editor,
  selectedIds,
  reportError: (message) => emit('error', message)
})
const {
  images,
  nodes: referencedNodes,
  canToggleSelection: canAddSelection,
  selectionActive: selectionContextActive,
  openImageDialog,
  removeImage,
  removeNode: removeReferencedNode,
  addNode: addReferencedNode,
  toggleSelection: toggleCurrentSelection,
  handlePaste,
  takeSubmission
} = attachments

// Pointing at the canvas in Describe adds that layer as context.
watch(pointRequest, (request) => {
  if (request) addReferencedNode(request.nodeId)
})

const isStreaming = computed(() => status === 'streaming' || status === 'submitted')
const isAgentProvider = computed(
  () => providerID.value.startsWith('acp:') || providerID.value === 'harness:pi'
)
const agentName = computed(() => {
  if (providerID.value === 'harness:pi') return 'Pi'
  const agentId = providerID.value.replace('acp:', '')
  return ACP_AGENTS.find((a) => a.id === agentId)?.name ?? agentId
})
const isCustomProvider = computed(
  () => providerID.value === 'openai-compatible' || providerID.value === 'anthropic-compatible'
)
const customModelName = computed(() => customModelID.value.trim())
const usesCustomModel = computed(
  () => !!providerDef.value.supportsCustomModel && !!customModelName.value
)
const selectedModelName = computed(() => {
  if (usesCustomModel.value) return customModelName.value
  if (isCustomProvider.value) return 'No model'
  return providerDef.value.models.find((m) => m.id === modelID.value)?.name ?? modelID.value
})
// Redrob Auto answers with the Design role; this names the profile that holds it.
const selectedProfileName = computed(
  () => designModelProfile.value?.name ?? selectedModelName.value
)

function submit(text: string): void {
  emit('submit', takeSubmission(text))
  input.value = ''
}
</script>

<template>
  <TooltipProvider>
    <div class="shrink-0 border-t border-border p-2.5">
      <Composer
        ref="composer"
        v-model="input"
        data-test-id="chat-composer"
        :label="composerText.fieldLabel"
        :placeholder="ai.describeChange"
        :submit-label="composerText.send"
        :stop-label="composerText.stop"
        :busy="isStreaming"
        :disabled="disabled"
        :max-rows="6"
        @submit="submit"
        @stop="emit('stop')"
        @paste="handlePaste"
      >
        <template v-if="images.length || referencedNodes.length" #context>
          <div
            v-for="node in referencedNodes"
            :key="node.id"
            data-slot="chat-context-chip"
            class="flex min-w-0 max-w-full items-center gap-2 rounded-lg border border-border bg-canvas p-1.5 shadow-xs"
          >
            <ChatNodePreview :editor="editor" :node="node" />
            <span class="min-w-0 flex-1 truncate text-xs text-surface">
              {{ node.name || node.type }}
            </span>
            <IconButton
              :label="ai.removeNodeContext"
              size="xs"
              @click="removeReferencedNode(node.id)"
            >
              <icon-lucide-x class="size-3" />
            </IconButton>
          </div>
          <div
            v-for="(image, index) in images"
            :key="image.previewURL"
            class="flex min-w-0 max-w-full items-center gap-2 rounded-lg border border-border bg-canvas p-1.5 shadow-xs"
          >
            <img
              :src="image.previewURL"
              :alt="image.file.name"
              width="40"
              height="40"
              class="size-10 shrink-0 rounded-md border border-border object-cover"
            />
            <span class="min-w-0 flex-1 truncate text-xs text-surface">
              {{ image.file.name }}
            </span>
            <IconButton
              :label="ai.removeImageAttachment({ name: image.file.name })"
              size="xs"
              @click="removeImage(index)"
            >
              <icon-lucide-x class="size-3" />
            </IconButton>
          </div>
        </template>

        <template #leading>
          <IconButton
            :label="composerText.addFiles"
            size="sm"
            :disabled="isStreaming || images.length >= MAX_IMAGE_ATTACHMENTS"
            @click="openImageDialog()"
          >
            <icon-lucide-plus class="size-4" />
          </IconButton>
          <IconButton
            :label="ai.addSelectionContext"
            size="sm"
            :active="selectionContextActive"
            :disabled="isStreaming || !canAddSelection"
            data-slot="chat-add-selection-context"
            @click="toggleCurrentSelection"
          >
            <icon-lucide-mouse-pointer-2 class="size-4" />
          </IconButton>
        </template>

        <template #tools>
          <div
            v-if="isAgentProvider"
            class="flex min-w-0 items-center gap-1 px-1.5 text-xs text-muted"
          >
            <icon-lucide-bot class="size-3.5 shrink-0" />
            <span class="truncate">{{ agentName }}</span>
          </div>
          <ComposerControlsTools v-else compact />
        </template>

        <template #status>
          <ComposerControlsStatus>
            <template #end>
              <ChatProfileSelect v-if="!isAgentProvider">
                <template #value>
                  <span class="min-w-0 truncate">{{ selectedProfileName }}</span>
                </template>
              </ChatProfileSelect>
              <IconButton
                :label="composerText.modelsAndKeys"
                size="sm"
                data-test-id="provider-settings-trigger"
                @click="openSettingsDialog('ai')"
              >
                <icon-lucide-settings class="size-3.5" />
              </IconButton>
            </template>
          </ComposerControlsStatus>
        </template>
      </Composer>
    </div>
  </TooltipProvider>
</template>

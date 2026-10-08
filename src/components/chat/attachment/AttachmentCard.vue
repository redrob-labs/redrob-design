<script setup lang="ts">
import { useObjectUrl } from '@vueuse/core'
import { computed, ref, toRef } from 'vue'

import { useI18n } from '@redrob-design/vue'

import type { AttachmentPresentation } from '@/app/ai/attachment/presentation/types'
import { AppDialogBody, AppDialogHeader, AppDialogRoot } from '@/components/ui/dialog'

const { attachment } = defineProps<{ attachment: AttachmentPresentation }>()
const { ai } = useI18n()
const viewerOpen = ref(false)
const previewURL = useObjectUrl(toRef(() => attachment.preview))
const typeLabel = computed(() => {
  if (attachment.kind === 'image')
    return attachment.mediaType.split('/')[1]?.toUpperCase() ?? 'Image'
  return attachment.nodeType
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^./, (character) => character.toUpperCase())
})
const dimensions = computed(
  () => `${Math.round(attachment.originalSize.x)} × ${Math.round(attachment.originalSize.y)}`
)
</script>

<template>
  <button
    type="button"
    :aria-label="ai.viewAttachment({ name: attachment.name })"
    class="group block overflow-hidden rounded-lg border border-on-accent/25 bg-ink-dark/15 text-left shadow-xs transition-colors hover:border-on-accent/50 focus-visible:border-on-accent/60 focus-visible:outline-2 focus-visible:outline-on-accent"
    @click="viewerOpen = true"
  >
    <img
      v-if="previewURL"
      :src="previewURL"
      :alt="attachment.name"
      class="h-20 w-28 border-b border-on-accent/15 bg-ink-dark/10 object-contain"
    />
    <span
      class="block max-w-28 truncate px-1.5 py-1 text-[9px] leading-tight text-on-accent/85 group-hover:text-on-accent"
    >
      {{ attachment.name }}
    </span>
  </button>

  <AppDialogRoot v-model:open="viewerOpen" size="xl">
    <AppDialogHeader
      :heading="attachment.name"
      :description="ai.attachmentPreview"
      :close-label="ai.closeAttachmentPreview"
    />
    <AppDialogBody class="flex min-h-0 items-center justify-center bg-canvas p-4">
      <img
        v-if="previewURL"
        :src="previewURL"
        :alt="attachment.name"
        class="max-h-[75vh] max-w-full object-contain"
      />
    </AppDialogBody>
    <div class="border-t border-border px-4 py-2 text-xs text-muted">
      {{ typeLabel }} · {{ dimensions }}
    </div>
  </AppDialogRoot>
</template>

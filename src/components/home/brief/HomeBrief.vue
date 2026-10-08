<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { tv } from 'tailwind-variants'
import { TooltipProvider } from 'reka-ui'

import { useComposerMessages, useHomeMessages } from '@redrob-design/vue'

import ComposerControlsStatus from '@/components/chat/composer/ComposerControlsStatus.vue'
import ComposerControlsTools from '@/components/chat/composer/ComposerControlsTools.vue'
import Composer from '@/components/ui/agent/Composer.vue'
import PromptSuggestions from '@/components/ui/agent/PromptSuggestions.vue'
import type { PromptSuggestion } from '@/components/ui/agent/types'
import {
  IMAGE_ATTACHMENT_MEDIA_TYPES,
  MAX_IMAGE_ATTACHMENTS,
  type ImageAttachmentDraft
} from '@/app/ai/attachment/image/types'
import { createImagePreviewURL, revokeImagePreviewURL } from '@/app/ai/attachment/image/prepare'
import { startBrief } from '@/app/home/brief'
import homeTheme from '@/theme/home'

const t = useHomeMessages()
const composerText = useComposerMessages()
const styles = tv(homeTheme)()

const text = ref('')
const images = ref<ImageAttachmentDraft[]>([])
const dragging = ref(false)
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')

const suggestions = computed<PromptSuggestion[]>(() => [
  { label: t.value.suggestionPricing, value: t.value.suggestionPricingBrief },
  { label: t.value.suggestionOnboarding },
  { label: t.value.suggestionLaunch }
])

const accept = IMAGE_ATTACHMENT_MEDIA_TYPES.join(',')

function isImage(file: File): boolean {
  return (IMAGE_ATTACHMENT_MEDIA_TYPES as readonly string[]).includes(file.type)
}

function addFiles(files: FileList | File[] | null | undefined): void {
  if (!files) return
  for (const file of Array.from(files)) {
    if (!isImage(file) || images.value.length >= MAX_IMAGE_ATTACHMENTS) continue
    images.value.push({ file, previewURL: createImagePreviewURL(file) })
  }
}

function removeImage(index: number): void {
  const [removed] = images.value.splice(index, 1)
  if (removed) revokeImagePreviewURL(removed.previewURL)
}

function onInputChange(event: Event): void {
  if (!(event.target instanceof HTMLInputElement)) return
  addFiles(event.target.files)
  event.target.value = ''
}

function onDrop(event: DragEvent): void {
  dragging.value = false
  addFiles(event.dataTransfer?.files)
}

function start(value: string): void {
  const brief = value.trim()
  if (!brief) return
  startBrief({ modelText: brief, displayText: brief, images: [...images.value], nodes: [] })
  text.value = ''
  images.value = []
}
</script>

<template>
  <TooltipProvider>
    <section aria-labelledby="home-brief-title" data-test-id="home-brief" :class="styles.brief()">
      <h1 id="home-brief-title" :class="styles.title()">{{ t.title }}</h1>
      <p :class="styles.lede()">{{ t.lede }}</p>
      <div
        :data-drag="dragging"
        :class="styles.drop()"
        @dragover.prevent="dragging = true"
        @dragleave="dragging = false"
        @drop.prevent="onDrop"
      >
        <input
          ref="fileInput"
          type="file"
          multiple
          class="sr-only"
          tabindex="-1"
          aria-hidden="true"
          :accept="accept"
          @change="onInputChange"
        />
        <Composer
          v-model="text"
          :label="t.briefLabel"
          :placeholder="t.briefPlaceholder"
          :submit-label="t.start"
          :stop-label="composerText.stop"
          :add-label="t.addFiles"
          :max-rows="8"
          show-submit-label
          @add="fileInput?.click()"
          @submit="start"
        >
          <template v-if="images.length" #context>
            <span v-for="(image, index) in images" :key="image.previewURL" :class="styles.chip()">
              <icon-lucide-image class="size-3.5 shrink-0 text-muted" />
              <span :class="styles.chipName()">{{ image.file.name }}</span>
              <button
                type="button"
                :aria-label="t.removeFile({ name: image.file.name })"
                :class="styles.chipRemove()"
                @click="removeImage(index)"
              >
                <icon-lucide-x class="size-3" />
              </button>
            </span>
          </template>
          <template #tools>
            <ComposerControlsTools />
          </template>
          <template #status>
            <ComposerControlsStatus />
          </template>
        </Composer>
      </div>
      <PromptSuggestions
        v-if="!text"
        :items="suggestions"
        :label="t.suggestionsLabel"
        :class="styles.suggestions()"
        @select="text = $event"
      />
    </section>
  </TooltipProvider>
</template>

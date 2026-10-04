<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import { computed } from 'vue'

import { useThreadMessages } from '@redrob-design/vue'

import { useEditorStore } from '@/app/editor/active-store'
import { pageLanguages } from '@/app/language/versions'
import ChatPanel from '@/components/ChatPanel.vue'
import EditorCanvas from '@/components/EditorCanvas.vue'

import ThreadResizer from './ThreadResizer.vue'

/** Thread width bounds from the prototype: 440 by default, 340 to 720. */
const THREAD_WIDTH = { initial: 440, min: 340, max: 720 } as const

/**
 * Describe: the file is on the canvas to look at and point at, and the
 * thread beside it is where it changes.
 */
const store = useEditorStore()
const t = useThreadMessages()
const storedWidth = useLocalStorage('redrob-design:describe-thread-width', THREAD_WIDTH.initial)
const languages = computed(() => {
  void store.state.sceneVersion
  return pageLanguages(store.graph, store.state.currentPageId)
})
const threadWidth = computed({
  get: () => Math.min(THREAD_WIDTH.max, Math.max(THREAD_WIDTH.min, storedWidth.value)),
  set: (value: number) => {
    storedWidth.value = value
  }
})
</script>

<template>
  <div data-test-id="describe-workspace" class="flex flex-1 overflow-hidden">
    <section :aria-label="t.canvasRegion" class="relative flex min-w-0 flex-1 flex-col">
      <div
        data-test-id="describe-canvas-bar"
        class="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-panel px-3 text-xs text-muted"
      >
        <icon-lucide-mouse-pointer-click class="size-3.5 shrink-0" />
        <span class="truncate">{{ t.pointHint }}</span>
        <span
          v-if="languages.length > 0"
          data-test-id="describe-languages"
          class="ml-auto flex shrink-0 items-center gap-1"
        >
          <icon-lucide-languages class="size-3.5" />
          {{ t.shipsIn({ languages: languages.join(', ') }) }}
        </span>
      </div>
      <div class="relative flex min-h-0 flex-1">
        <EditorCanvas />
      </div>
    </section>
    <ThreadResizer
      v-model="threadWidth"
      :min="THREAD_WIDTH.min"
      :max="THREAD_WIDTH.max"
      :label="t.resizeThread"
    />
    <aside
      data-test-id="describe-thread"
      :aria-label="t.threadRegion"
      class="flex shrink-0 flex-col border-l border-border bg-panel"
      :style="{ width: `${threadWidth}px` }"
    >
      <div class="flex h-10 shrink-0 items-center border-b border-border px-3">
        <span class="truncate text-[13px] font-semibold text-surface">
          {{ store.state.documentName }}
        </span>
      </div>
      <ChatPanel />
    </aside>
  </div>
</template>

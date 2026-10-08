<script setup lang="ts">
import { watch } from 'vue'
import { templateRef } from '@vueuse/core'

import { useI18n } from '@redrob-design/vue'
import { appMenuShortcutLabel } from '@/app/shell/menu/shortcut'
import { useDocumentNameRename } from '@/app/shell/menu/document-name'
import { useEditorStore } from '@/app/editor/active-store'

const store = useEditorStore()

const { rename, editingName, startRename, commitRename } = useDocumentNameRename(store)
const nameInput = templateRef<HTMLInputElement>('nameInput')

watch(nameInput, (input) => {
  if (input) void rename.focusInput(input)
})

const { menu: t } = useI18n()
</script>

<template>
  <div class="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
    <input
      v-if="editingName"
      ref="nameInput"
      data-test-id="app-document-name-input"
      class="min-w-0 flex-1 rounded border border-accent bg-input px-1 py-0.5 text-[13px] font-semibold text-surface outline-none"
      :value="store.state.documentName"
      @blur="commitRename($event)"
      @keydown="rename.onKeydown"
    />
    <span
      v-else
      data-test-id="app-document-name"
      class="min-w-0 flex-1 cursor-default truncate rounded px-1 py-0.5 text-[13px] font-semibold text-surface hover:bg-hover"
      @dblclick="startRename"
      >{{ store.state.documentName }}</span
    >
    <Tip :label="`${t.toggleUI} (${appMenuShortcutLabel('toggle-ui')})`">
      <button
        type="button"
        data-test-id="app-toggle-ui"
        :aria-label="t.toggleUI"
        class="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-hover hover:text-surface focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        @click="store.state.showUI = !store.state.showUI"
      >
        <icon-lucide-panel-left class="size-4" />
      </button>
    </Tip>
  </div>
</template>

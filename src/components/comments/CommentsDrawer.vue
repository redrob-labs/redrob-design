<script setup lang="ts">
import { computed } from 'vue'

import { useCommentsMessages } from '@redrob-design/vue'

import { activeFilePermissions } from '@/app/cloud/files'
import { activeDocumentKey, commentsPanelOpen, startCommenting } from '@/app/comments/service'
import { activeThreadId, threadsFor } from '@/app/comments/store'
import type { CommentThread } from '@/app/comments/types'
import { getActiveEditorStoreOrNull } from '@/app/editor/active-store'
import { signedIn } from '@/app/integrations/console'
import AppButton from '@/components/ui/AppButton.vue'
import AppDialog from '@/components/ui/dialog/AppDialog.vue'

/** Every thread on the open file, open ones first; picking one opens its pin. */
const t = useCommentsMessages()
const documentKey = computed(() => (commentsPanelOpen.value ? activeDocumentKey() : null))
const threads = computed(() => {
  const key = documentKey.value
  if (!key) return []
  const all = threadsFor(key).map((thread, index) => ({ thread, number: index + 1 }))
  return [
    ...all.filter((entry) => !entry.thread.root.resolved),
    ...all.filter((entry) => entry.thread.root.resolved)
  ]
})
const documentName = computed(() => getActiveEditorStoreOrNull()?.state.documentName ?? '')

function openThread(thread: CommentThread): void {
  const store = getActiveEditorStoreOrNull()
  commentsPanelOpen.value = false
  if (store && store.state.currentPageId !== thread.root.anchor.pageId) {
    void store.switchPage(thread.root.anchor.pageId)
  }
  activeThreadId.value = thread.id
}
</script>

<template>
  <AppDialog
    v-model:open="commentsPanelOpen"
    data-test-id="comments-panel"
    placement="right"
    size="md"
    :heading="t.heading"
    :description="t.description({ name: documentName })"
    :close-label="t.close"
  >
    <div class="flex flex-col gap-3 text-xs">
      <p class="text-muted" data-slot="comments-sharing">
        {{ signedIn ? t.shared : t.notShared }}
      </p>
      <AppButton
        v-if="activeFilePermissions.comment"
        class="self-start"
        color="primary"
        variant="solid"
        @click="startCommenting"
      >
        <template #leading><icon-lucide-message-circle-plus /></template>
        {{ t.add }}
      </AppButton>
      <p v-if="threads.length === 0" class="text-muted">{{ t.empty }}</p>
      <ul v-else class="flex flex-col gap-1.5" :aria-label="t.heading">
        <li v-for="{ thread, number } in threads" :key="thread.id">
          <button
            type="button"
            data-slot="comments-thread"
            :data-resolved="thread.root.resolved ? 'true' : 'false'"
            class="flex w-full items-start gap-2 rounded-lg border border-border p-2.5 text-left hover:bg-hover focus-visible:ring-2 focus-visible:ring-panel-focus focus-visible:outline-none data-[resolved=true]:opacity-60"
            @click="openThread(thread)"
          >
            <span
              class="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-on-accent"
              :aria-label="t.threadLabel({ number })"
            >
              {{ number }}
            </span>
            <span class="flex min-w-0 flex-col gap-0.5">
              <span class="line-clamp-2 text-surface">{{ thread.root.text }}</span>
              <span class="text-muted">
                <template v-if="thread.root.resolved">{{ t.resolved }} · </template>
                {{ t.replies({ count: thread.replies.length }) }}
              </span>
            </span>
          </button>
        </li>
      </ul>
    </div>
  </AppDialog>
</template>

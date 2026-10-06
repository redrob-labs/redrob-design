<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot } from 'reka-ui'
import { computed, ref } from 'vue'

import { useCommentsMessages } from '@redrob-design/vue'

import { draftAnchor, stopCommenting } from '@/app/comments/service'
import {
  MAX_COMMENT_LENGTH,
  activeThreadId,
  addComment,
  deleteComment,
  setThreadResolved,
  threadsFor
} from '@/app/comments/store'
import { syncComments } from '@/app/comments/sync'
import { LOCAL_AUTHOR_ID, type LocalComment } from '@/app/comments/types'
import { toast } from '@/app/shell/ui'
import AppButton from '@/components/ui/AppButton.vue'
import AppTextarea from '@/components/ui/AppTextarea.vue'
import IconButton from '@/components/ui/IconButton.vue'

/** The thread at an open pin, or the box for a new comment at the draft pin. */
const { documentKey, reference } = defineProps<{
  documentKey: string
  reference: { getBoundingClientRect: () => DOMRect } | null
}>()

const t = useCommentsMessages()
const text = ref('')
const busy = ref(false)
const thread = computed(() =>
  activeThreadId.value
    ? (threadsFor(documentKey).find((candidate) => candidate.id === activeThreadId.value) ?? null)
    : null
)
const open = computed(() => Boolean(reference && (draftAnchor.value || thread.value)))
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

function authorOf(comment: LocalComment): string {
  return comment.author.id === LOCAL_AUTHOR_ID || !comment.author.name
    ? t.value.you
    : comment.author.name
}

function close(): void {
  text.value = ''
  if (draftAnchor.value) stopCommenting()
  activeThreadId.value = null
}

async function run(step: () => Promise<void>): Promise<void> {
  busy.value = true
  try {
    await step()
    void syncComments(documentKey)
  } catch (error) {
    toast.error(t.value.failed({ error: error instanceof Error ? error.message : String(error) }))
  } finally {
    busy.value = false
  }
}

function post(): void {
  const anchor = draftAnchor.value ?? thread.value?.root.anchor
  if (!anchor || text.value.trim() === '') return
  const threadId = draftAnchor.value ? null : (thread.value?.id ?? null)
  void run(async () => {
    const comment = await addComment(documentKey, { anchor, text: text.value, threadId })
    text.value = ''
    if (threadId === null && comment) {
      stopCommenting()
      activeThreadId.value = comment.id
    }
  })
}

function toggleResolved(): void {
  const current = thread.value
  if (!current) return
  void run(() => setThreadResolved(documentKey, current.id, !current.root.resolved))
}

function remove(comment: LocalComment): void {
  void run(() => deleteComment(documentKey, comment.id))
}
</script>

<template>
  <PopoverRoot :open="open">
    <PopoverPortal>
      <PopoverContent
        v-if="open && reference"
        :reference="reference"
        side="right"
        align="start"
        :side-offset="32"
        :collision-padding="8"
        data-test-id="comment-thread"
        class="z-50 flex w-72 flex-col gap-2 rounded-xl border border-border bg-panel p-3 text-xs shadow-lg"
        @escape-key-down="close"
        @open-auto-focus.prevent
      >
        <template v-if="thread">
          <div class="flex items-center justify-between gap-2">
            <span class="font-semibold text-surface">
              {{ thread.root.resolved ? t.resolved : t.heading }}
            </span>
            <div class="flex items-center gap-1">
              <AppButton
                size="xs"
                color="neutral"
                variant="ghost"
                :disabled="busy"
                @click="toggleResolved"
              >
                {{ thread.root.resolved ? t.reopen : t.resolve }}
              </AppButton>
              <IconButton :label="t.close" @click="close">
                <icon-lucide-x class="size-3.5" />
              </IconButton>
            </div>
          </div>
          <ul class="flex max-h-64 flex-col gap-2 overflow-y-auto">
            <li
              v-for="comment in [thread.root, ...thread.replies]"
              :key="comment.id"
              data-slot="comment"
              class="group flex flex-col gap-0.5"
            >
              <span class="flex items-center gap-1.5">
                <b class="text-surface">{{ authorOf(comment) }}</b>
                <span class="text-muted">{{ dateFormat.format(new Date(comment.createdAt)) }}</span>
                <IconButton
                  class="ml-auto"
                  :label="comment.id === thread.id ? t.deleteThread : t.deleteComment"
                  @click="remove(comment)"
                >
                  <icon-lucide-trash-2 class="size-3" />
                </IconButton>
              </span>
              <p class="whitespace-pre-wrap text-surface">{{ comment.text }}</p>
            </li>
          </ul>
        </template>
        <form class="flex flex-col gap-2" @submit.prevent="post">
          <label class="flex flex-col">
            <span class="sr-only">{{ thread ? t.replyPlaceholder : t.placeholder }}</span>
            <AppTextarea
              v-model="text"
              :rows="2"
              :maxlength="MAX_COMMENT_LENGTH"
              :placeholder="thread ? t.replyPlaceholder : t.placeholder"
              autofocus
            />
          </label>
          <div class="flex justify-end gap-1.5">
            <AppButton v-if="!thread" size="xs" color="neutral" variant="ghost" @click="close">
              {{ t.cancel }}
            </AppButton>
            <AppButton
              type="submit"
              size="xs"
              color="primary"
              variant="solid"
              :disabled="busy || text.trim() === ''"
            >
              {{ thread ? t.reply : t.post }}
            </AppButton>
          </div>
        </form>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

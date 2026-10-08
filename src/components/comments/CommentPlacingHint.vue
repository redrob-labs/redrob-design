<script setup lang="ts">
import { useCommentsMessages } from '@redrob-design/vue'

import { commentMode, stopCommenting } from '@/app/comments/service'

/** Says how placing works while a click on the canvas starts a thread. */
const t = useCommentsMessages()
</script>

<template>
  <div
    v-if="commentMode"
    role="status"
    data-test-id="comment-placing"
    class="absolute top-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-panel px-3 py-1.5 text-xs text-surface shadow-md"
  >
    <icon-lucide-message-circle-plus class="size-3.5 text-muted" />
    {{ t.placing }}
    <button
      type="button"
      class="rounded font-medium text-brand-ink hover:underline focus-visible:ring-2 focus-visible:ring-panel-focus focus-visible:outline-none"
      @click="stopCommenting"
    >
      {{ t.stopPlacing }}
    </button>
  </div>
</template>

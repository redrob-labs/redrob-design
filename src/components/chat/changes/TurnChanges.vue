<script setup lang="ts">
import { computed } from 'vue'

import { useThreadMessages } from '@redrob-design/vue'

import {
  changeSetFor,
  keepChanges,
  latestKept,
  putBackChanges,
  undoKeptChanges
} from '@/app/assistant/changes/store'
import Changes from '@/components/ui/agent/Changes.vue'

import { changeItems } from './items'

import type { ChangesWords } from '@/components/ui/agent/types'

/** The changes one answer made, under that answer, until the person decides. */
const { messageId } = defineProps<{ messageId: string }>()

const t = useThreadMessages()
const set = computed(() => changeSetFor(messageId))
const items = computed(() => {
  if (!set.value) return []
  const words = t.value
  return changeItems(set.value.items, {
    textOf: (name) => words.textOf({ name }),
    properties: {
      fill: words.propFill,
      stroke: words.propStroke,
      position: words.propPosition,
      size: words.propSize,
      text: words.propText,
      name: words.propName,
      opacity: words.propOpacity,
      effects: words.propEffects,
      corners: words.propCorners,
      type: words.propType,
      layout: words.propLayout,
      order: words.propOrder,
      visibility: words.propVisibility,
      other: words.propOther
    }
  })
})
const summary = computed(() =>
  items.value.length === 1 ? t.value.changesOne : t.value.changesMany({ count: items.value.length })
)
const words = computed<ChangesWords>(() => ({
  kinds: {
    added: t.value.changeAdded,
    removed: t.value.changeRemoved,
    changed: t.value.changeChanged
  },
  was: t.value.changeWas,
  now: t.value.changeNow,
  accept: t.value.keepIt,
  reject: t.value.putItBack
}))
const decided = computed(() => {
  switch (set.value?.status) {
    case 'kept':
      return t.value.changesKept
    case 'put-back':
      return t.value.changesPutBack
    case 'undone':
      return t.value.changesUndone
    default:
      return null
  }
})
const canUndo = computed(
  () => set.value?.status === 'kept' && latestKept(set.value.owner)?.id === set.value.id
)
</script>

<template>
  <template v-if="set && items.length > 0">
    <Changes
      v-if="set.status === 'open'"
      :heading="t.changesHeading"
      :summary="summary"
      :items="items"
      :words="words"
      @accept="keepChanges(messageId)"
      @reject="putBackChanges(messageId)"
    />
    <p v-else data-slot="changes-decided" class="flex items-center gap-1.5 text-xs text-muted">
      <icon-lucide-check v-if="set.status === 'kept'" class="size-3.5 shrink-0 text-success" />
      <icon-lucide-undo-2 v-else class="size-3.5 shrink-0" />
      <span>{{ decided }}</span>
      <button
        v-if="canUndo"
        type="button"
        data-slot="changes-undo"
        class="rounded font-medium text-brand-ink hover:underline focus-visible:ring-2 focus-visible:ring-panel-focus focus-visible:outline-none"
        @click="undoKeptChanges(messageId)"
      >
        {{ t.undo }}
      </button>
    </p>
  </template>
</template>

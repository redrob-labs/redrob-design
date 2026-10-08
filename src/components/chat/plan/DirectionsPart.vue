<script setup lang="ts">
import { computed, ref } from 'vue'

import { usePlanMessages } from '@redrob-design/vue'

import { getActiveEditorStoreOrNull } from '@/app/editor/active-store'
import { useChatSend } from '@/components/chat/submit'

interface DirectionFrame {
  id: string
  letter: string
  name: string
  idea: string
}

/** The directions `create_directions` started, each to show or to pick. */
const { output } = defineProps<{ output: unknown }>()

const t = usePlanMessages()
const send = useChatSend()
const picked = ref<string | null>(null)

function isDirection(value: unknown): value is DirectionFrame {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'letter' in value &&
    typeof value.letter === 'string' &&
    'name' in value &&
    typeof value.name === 'string' &&
    'idea' in value &&
    typeof value.idea === 'string'
  )
}

const directions = computed<DirectionFrame[]>(() => {
  const list =
    typeof output === 'object' && output !== null && 'directions' in output
      ? output.directions
      : null
  return Array.isArray(list) ? list.filter(isDirection) : []
})

function show(direction: DirectionFrame): void {
  const store = getActiveEditorStoreOrNull()
  const node = store?.graph.getNode(direction.id)
  if (!store || !node) return
  store.zoomToBounds(node.x, node.y, node.x + node.width, node.y + node.height)
}

function pick(direction: DirectionFrame): void {
  if (picked.value) return
  picked.value = direction.id
  show(direction)
  send(t.value.pickDirection({ letter: direction.letter, name: direction.name }))
}
</script>

<template>
  <section
    v-if="directions.length > 0"
    data-slot="directions-part"
    :aria-label="t.directionsLabel"
    class="flex flex-col gap-2"
  >
    <p class="text-xs leading-relaxed text-surface">{{ t.directionsIntro }}</p>
    <div class="grid grid-cols-2 gap-2">
      <button
        v-for="direction in directions"
        :key="direction.id"
        type="button"
        :aria-pressed="picked === direction.id"
        :disabled="picked !== null && picked !== direction.id"
        class="flex cursor-pointer flex-col gap-1 rounded-xl border border-border bg-panel p-2.5 text-left transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-panel-focus focus-visible:outline-none disabled:cursor-default disabled:opacity-60 aria-pressed:border-accent"
        @click="pick(direction)"
      >
        <span class="text-[11px] font-semibold text-brand-ink">
          {{ t.directionLetter({ letter: direction.letter }) }}
        </span>
        <span class="text-[13px] font-semibold text-surface">{{ direction.name }}</span>
        <span class="text-xs text-muted">{{ direction.idea }}</span>
      </button>
    </div>
  </section>
</template>

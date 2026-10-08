<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { tv } from 'tailwind-variants'

import splitterTheme from '@/theme/splitter'

/**
 * The edge between the canvas and the thread. Dragging left widens the
 * thread; the arrow keys move it in steps.
 */
const { min, max, label } = defineProps<{ min: number; max: number; label: string }>()
const width = defineModel<number>({ required: true })

const KEY_STEP = 16
const styles = tv(splitterTheme)({ direction: 'horizontal' })
let drag: { startX: number; startWidth: number } | null = null

function clamp(value: number): number {
  return Math.round(Math.min(max, Math.max(min, value)))
}

function start(event: PointerEvent): void {
  if (event.button !== 0) return
  drag = { startX: event.clientX, startWidth: width.value }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  event.preventDefault()
}

function move(event: PointerEvent): void {
  if (!drag) return
  width.value = clamp(drag.startWidth + (drag.startX - event.clientX))
}

function onKeydown(event: KeyboardEvent): void {
  const steps: Partial<Record<string, number>> = {
    ArrowLeft: KEY_STEP,
    ArrowRight: -KEY_STEP,
    Home: max,
    End: -max
  }
  const step = steps[event.code]
  if (step === undefined) return
  event.preventDefault()
  width.value = clamp(width.value + step)
}

useEventListener(window, 'pointerup', () => {
  drag = null
})
</script>

<template>
  <div
    role="separator"
    tabindex="0"
    aria-orientation="vertical"
    :aria-label="label"
    :aria-valuemin="min"
    :aria-valuemax="max"
    :aria-valuenow="width"
    data-test-id="describe-thread-resizer"
    :class="styles.handle()"
    @pointerdown="start"
    @pointermove="move"
    @keydown="onKeydown"
  >
    <div :class="styles.divider()" />
  </div>
</template>

<script lang="ts">
import type { ComponentUI } from '@/components/ui/types'
import type { ComposerTheme } from '@/theme/agent/composer'

export type ComposerUI = ComponentUI<ComposerTheme>

/** The message field, after the design system's `Composer`. Enter sends; Shift+Enter is a new line. */
export interface ComposerProps {
  placeholder?: string
  /** Accessible name of the field. */
  label: string
  submitLabel: string
  stopLabel: string
  addLabel?: string
  /** The agent is working: Send becomes Stop. */
  busy?: boolean
  disabled?: boolean
  /** Hides the default Add button in the bar. */
  hideAdd?: boolean
  maxRows?: number
  /** Shows the submit label beside the arrow, as Home's Start does. */
  showSubmitLabel?: boolean
  ui?: ComposerUI
}
</script>

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { useTextareaAutosize } from '@vueuse/core'
import { tv } from 'tailwind-variants'

import Tip from '@/components/ui/Tip.vue'
import theme from '@/theme/agent/composer'

const {
  placeholder,
  label,
  submitLabel,
  stopLabel,
  addLabel,
  busy = false,
  disabled = false,
  hideAdd = false,
  maxRows = 6,
  showSubmitLabel = false,
  ui
} = defineProps<ComposerProps>()

const model = defineModel<string>({ default: '' })
const emit = defineEmits<{
  submit: [value: string]
  stop: []
  add: []
  paste: [event: ClipboardEvent]
}>()
defineSlots<{
  context?(): unknown
  leading?(): unknown
  tools?(): unknown
  status?(): unknown
}>()

const textarea = useTemplateRef<HTMLTextAreaElement>('textarea')
const LINE_HEIGHT = 24
const PADDING = 16
useTextareaAutosize({ element: textarea, input: model })
const inputStyle = computed(() => ({ maxHeight: `${maxRows * LINE_HEIGHT + PADDING}px` }))

const styles = computed(() => tv(theme)())
const canSubmit = computed(() => !disabled && !busy && model.value.trim().length > 0)

function submit(): void {
  if (!canSubmit.value) return
  emit('submit', model.value.trim())
}

function onKeydown(event: KeyboardEvent): void {
  if (event.code !== 'Enter' || event.shiftKey || event.isComposing) return
  event.preventDefault()
  submit()
}

defineExpose({
  focus: () => textarea.value?.focus()
})
</script>

<template>
  <div data-slot="composer" :class="styles.root({ class: ui?.root })">
    <div data-slot="composer-box" :class="styles.box({ class: ui?.box })">
      <div v-if="$slots.context" data-slot="composer-context" :class="styles.context()">
        <slot name="context" />
      </div>
      <textarea
        ref="textarea"
        v-model="model"
        rows="1"
        data-slot="composer-input"
        :aria-label="label"
        :placeholder="placeholder"
        :disabled="disabled"
        :class="styles.input({ class: ui?.input })"
        :style="inputStyle"
        @keydown="onKeydown"
        @paste="emit('paste', $event)"
        @copy.stop
        @cut.stop
      />
      <div data-slot="composer-bar" :class="styles.bar({ class: ui?.bar })">
        <div :class="styles.leading()">
          <slot name="leading">
            <Tip v-if="!hideAdd && addLabel" :label="addLabel">
              <button
                type="button"
                data-slot="composer-add"
                :aria-label="addLabel"
                :disabled="disabled || busy"
                :class="styles.iconButton()"
                @click="emit('add')"
              >
                <icon-lucide-plus :class="styles.icon()" />
              </button>
            </Tip>
          </slot>
        </div>
        <div :class="styles.tools({ class: ui?.tools })">
          <slot name="tools" />
          <button
            v-if="busy"
            type="button"
            data-slot="composer-stop"
            :class="styles.stop()"
            @click="emit('stop')"
          >
            <icon-lucide-square class="size-3" />
            {{ stopLabel }}
          </button>
          <Tip v-else :label="submitLabel">
            <button
              type="button"
              data-slot="composer-send"
              :aria-label="submitLabel"
              :disabled="!canSubmit"
              :class="styles.send()"
              @click="submit"
            >
              <span v-if="showSubmitLabel">{{ submitLabel }}</span>
              <icon-lucide-arrow-up :class="styles.icon()" />
            </button>
          </Tip>
        </div>
      </div>
    </div>
    <slot name="status" />
  </div>
</template>

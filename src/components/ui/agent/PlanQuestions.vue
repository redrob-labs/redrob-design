<script setup lang="ts">
import type { PlanQuestionItem } from './types'

/**
 * The questions Plan asks before it draws, each answered with one tap.
 * Controlled: the app keeps the answers and decides when they are sent.
 */
const {
  questions,
  answers,
  label,
  disabled = false
} = defineProps<{
  questions: PlanQuestionItem[]
  answers: Partial<Record<string, string>>
  label: string
  disabled?: boolean
}>()

const emit = defineEmits<{ answer: [questionId: string, option: string] }>()
</script>

<template>
  <div data-slot="plan-questions" role="group" :aria-label="label" class="flex flex-col gap-3">
    <fieldset v-for="question in questions" :key="question.id" class="flex flex-col gap-1.5">
      <legend class="mb-1.5 text-[13px] font-medium text-surface">{{ question.question }}</legend>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="option in question.options"
          :key="option"
          type="button"
          :aria-pressed="answers[question.id] === option"
          :disabled="disabled"
          class="h-7 cursor-pointer rounded-full border border-border px-3 text-xs text-surface transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-panel-focus focus-visible:outline-none disabled:cursor-default disabled:opacity-60 aria-pressed:border-accent aria-pressed:bg-accent/10 aria-pressed:font-semibold"
          @click="emit('answer', question.id, option)"
        >
          {{ option }}
        </button>
      </div>
    </fieldset>
  </div>
</template>

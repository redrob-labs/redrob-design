<script setup lang="ts">
import { computed, ref } from 'vue'

import { parsePlanQuestions, type PlanQuestion } from '@redrob-design/core/tools'
import { usePlanMessages } from '@redrob-design/vue'

import { getActiveEditorStoreOrNull } from '@/app/editor/active-store'
import { designMemorySource, openDesignMemory } from '@/app/memory/service'
import { colorCount } from '@/app/memory/types'
import { useChatSend } from '@/components/chat/submit'
import AppButton from '@/components/ui/AppButton.vue'
import MemoryCard from '@/components/ui/agent/MemoryCard.vue'
import PlanQuestions from '@/components/ui/agent/PlanQuestions.vue'

/**
 * Plan's first answer: Design Memory, then the questions it asked with
 * `ask_plan_questions`. Answering every question, or skipping, sends the
 * answers as the next message.
 */
const { input, answered = false } = defineProps<{ input: unknown; answered?: boolean }>()

const t = usePlanMessages()
const send = useChatSend()
const answers = ref<Partial<Record<string, string>>>({})
const sent = ref(false)

const questions = computed<PlanQuestion[]>(() => {
  const raw =
    typeof input === 'object' && input !== null && 'questions' in input ? input.questions : null
  return typeof raw === 'string' ? (parsePlanQuestions(raw) ?? []) : []
})

const memory = computed(() => {
  const store = getActiveEditorStoreOrNull()
  return store ? designMemorySource().read(store.graph, store.state.documentName) : null
})
const summary = computed(() => {
  const value = memory.value
  if (!value) return ''
  return t.value.memorySummary({
    colors: colorCount(value),
    typefaces: value.typefaces.length,
    components: value.components.length,
    rules: value.rules.length
  })
})
const swatches = computed(() =>
  (memory.value?.colors ?? []).flatMap((group) => group.swatches.map((swatch) => swatch.hex))
)
const locked = computed(() => answered || sent.value)

function finish(text: string): void {
  if (locked.value) return
  sent.value = true
  send(text)
}

function answer(questionId: string, option: string): void {
  if (locked.value) return
  answers.value = { ...answers.value, [questionId]: option }
  if (questions.value.every((question) => answers.value[question.id])) {
    finish(
      questions.value
        .map((question) => `${question.question} ${answers.value[question.id] ?? ''}`)
        .join('\n')
    )
  }
}

function skip(): void {
  const given = questions.value
    .filter((question) => answers.value[question.id])
    .map((question) => `${question.question} ${answers.value[question.id] ?? ''}`)
  finish([...given, t.value.bestGuess].join('\n'))
}
</script>

<template>
  <div v-if="questions.length > 0" data-slot="plan-questions-part" class="flex flex-col gap-3">
    <MemoryCard
      v-if="memory"
      :swatches="swatches"
      :heading="t.memoryHeading"
      :summary="summary"
      :open-label="t.memoryOpen"
      @open="openDesignMemory"
    />
    <p class="text-xs leading-relaxed text-surface">{{ t.questionsIntro }}</p>
    <PlanQuestions
      :questions="questions"
      :answers="answers"
      :label="t.questionsLabel"
      :disabled="locked"
      @answer="answer"
    />
    <AppButton v-if="!locked" color="primary" variant="link" class="self-start" @click="skip">
      {{ t.skip }}
    </AppButton>
  </div>
</template>

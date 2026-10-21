<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from '@redrob-design/vue'

import { answerEngineQuestion, dismissEngineQuestion, engineQuestions } from '@/app/ai/acp/question'
import { toast } from '@/app/shell/ui'
import AppButton from '@/components/ui/AppButton.vue'

/**
 * Redrob Code's `question` tool, while it waits for the person: the questions, their choices and
 * a free answer, sent back to the engine (app/ai/acp/question.ts). The tool row takes over again
 * once the engine reports the call finished.
 */
const { input, toolCallId } = defineProps<{ input: unknown; toolCallId: string }>()

const { ai } = useI18n()
const questions = computed(() => engineQuestions(input))
const picked = ref<string[][]>([])
const typed = ref<string[]>([])
const sending = ref(false)
const sent = ref(false)

function isPicked(index: number, label: string): boolean {
  return picked.value[index]?.includes(label) ?? false
}

function pick(index: number, label: string): void {
  if (sending.value || sent.value) return
  const current = picked.value[index] ?? []
  const multiple = questions.value[index]?.multiple === true
  const toggled = current.includes(label)
    ? current.filter((item) => item !== label)
    : [...current, label]
  const next = multiple ? toggled : [label]
  const all = [...picked.value]
  all[index] = next
  picked.value = all
}

function answers(): string[][] {
  return questions.value.map((_, index) => {
    const custom = typed.value[index]?.trim()
    return [...(picked.value[index] ?? []), ...(custom ? [custom] : [])]
  })
}

const ready = computed(() => answers().every((answer) => answer.length > 0))

async function run(action: () => Promise<boolean>): Promise<void> {
  if (sending.value || sent.value) return
  sending.value = true
  try {
    if (await action()) sent.value = true
    else toast.error(ai.value.engineQuestionFailed)
  } catch {
    toast.error(ai.value.engineQuestionFailed)
  } finally {
    sending.value = false
  }
}

const send = () => run(() => answerEngineQuestion(toolCallId, answers()))
const skip = () => run(() => dismissEngineQuestion(toolCallId))
</script>

<template>
  <div
    v-if="questions.length > 0"
    data-slot="engine-question-part"
    role="group"
    :aria-label="ai.engineQuestionLabel"
    class="flex flex-col gap-3 rounded-lg border border-ai-border bg-ai p-3"
  >
    <fieldset
      v-for="(question, index) in questions"
      :key="index"
      class="flex flex-col gap-1.5"
      :disabled="sending || sent"
    >
      <legend class="mb-1.5 text-[13px] font-medium text-surface">
        <span v-if="question.header" class="mr-1 text-[11px] text-muted">{{
          question.header
        }}</span>
        {{ question.question }}
      </legend>
      <div v-if="question.options.length" class="flex flex-wrap gap-1.5">
        <button
          v-for="option in question.options"
          :key="option.label"
          type="button"
          :aria-pressed="isPicked(index, option.label)"
          class="h-7 cursor-pointer rounded-full border border-border px-3 text-xs text-surface transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-panel-focus focus-visible:outline-none disabled:cursor-default disabled:opacity-60 aria-pressed:border-accent aria-pressed:bg-accent/10 aria-pressed:font-semibold"
          @click="pick(index, option.label)"
        >
          {{ option.label }}
        </button>
      </div>
      <input
        v-if="question.custom || question.options.length === 0"
        v-model="typed[index]"
        type="text"
        :aria-label="ai.engineQuestionCustom"
        :placeholder="ai.engineQuestionCustom"
        class="h-7 rounded border border-border bg-input px-2 text-xs text-surface focus-visible:ring-2 focus-visible:ring-panel-focus focus-visible:outline-none"
        @keydown.enter.prevent="ready && send()"
      />
    </fieldset>
    <div v-if="!sent" class="flex items-center gap-2">
      <AppButton color="primary" variant="solid" :disabled="!ready || sending" @click="send">
        {{ ai.engineQuestionSend }}
      </AppButton>
      <AppButton variant="link" :disabled="sending" @click="skip">
        {{ ai.engineQuestionSkip }}
      </AppButton>
    </div>
  </div>
</template>

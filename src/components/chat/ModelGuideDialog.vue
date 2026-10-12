<script setup lang="ts">
import { useStore } from '@nanostores/vue'
import { computed, ref, watch } from 'vue'

import { locale, useI18n } from '@redrob-design/vue'
import type { GuideEditionResponse } from '@redrob-labs/route-labeller'

import { loadModelGuide } from '@/app/ai/model-guide'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppDialogBody from '@/components/ui/dialog/AppDialogBody.vue'
import AppDialogHeader from '@/components/ui/dialog/AppDialogHeader.vue'
import AppDialogRoot from '@/components/ui/dialog/AppDialogRoot.vue'
/**
 * The ModelGuide edition Redrob Auto routes on: for a profession, a task and a working language, the
 * ranked picks Auto takes in order, at the effort each was ranked at. Read from Console, so it is the
 * ranking this window's requests are actually routed by.
 */
const { ai } = useI18n()
const current = useStore(locale)
const open = ref(false)
const edition = ref<GuideEditionResponse | null | undefined>(undefined)
const professionID = ref('')
const taskID = ref('')
const language = ref<'en' | 'ko' | 'hi'>('en')

const label = (value: { en: string; ko: string }) => (current.value === 'ko' ? value.ko : value.en)

watch(open, async (isOpen) => {
  if (!isOpen || edition.value) return
  edition.value = await loadModelGuide().catch(() => null)
  const first = edition.value?.professions[0]
  professionID.value = first?.id ?? ''
  taskID.value = first?.tasks[0]?.id ?? ''
  language.value = current.value === 'ko' ? 'ko' : 'en'
})

const profession = computed(() =>
  edition.value?.professions.find((candidate) => candidate.id === professionID.value)
)
watch(professionID, () => {
  if (!profession.value?.tasks.some((task) => task.id === taskID.value)) {
    taskID.value = profession.value?.tasks[0]?.id ?? ''
  }
})
const task = computed(() =>
  profession.value?.tasks.find((candidate) => candidate.id === taskID.value)
)
const picks = computed(() => {
  const ranked = task.value?.picks[language.value]
  return (ranked?.length ? ranked : task.value?.picks.en) ?? []
})

const professionOptions = computed(() =>
  (edition.value?.professions ?? []).map((item) => ({ value: item.id, label: label(item.label) }))
)
const taskOptions = computed(() =>
  (profession.value?.tasks ?? []).map((item) => ({ value: item.id, label: label(item.label) }))
)
const languageOptions = computed(() => [
  { value: 'en' as const, label: ai.value.modelGuideLanguageEn },
  { value: 'ko' as const, label: ai.value.modelGuideLanguageKo },
  { value: 'hi' as const, label: ai.value.modelGuideLanguageHi }
])

const modelName = (id: string) => edition.value?.models[id] ?? id
const usd = (amount: number) =>
  new Intl.NumberFormat(current.value === 'ko' ? 'ko-KR' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: amount < 10 ? 2 : 0
  }).format(amount)
</script>

<template>
  <AppButton size="xs" color="neutral" variant="link" @click="open = true">
    {{ ai.modelGuideOpen }}
  </AppButton>
  <AppDialogRoot v-model:open="open" size="xl" height="tall">
    <AppDialogHeader
      :heading="ai.modelGuideTitle"
      :description="ai.modelGuideDescription"
      :close-label="ai.connectRedrobCancel"
    />
    <AppDialogBody>
      <p v-if="edition === undefined" class="text-xs text-muted">{{ ai.modelGuideLoading }}</p>
      <p v-else-if="edition === null" class="text-xs text-muted">{{ ai.modelGuideUnavailable }}</p>
      <div v-else class="flex flex-col gap-3" data-test-id="model-guide">
        <div class="grid grid-cols-3 gap-2">
          <AppSelect
            v-model="professionID"
            :label="ai.modelGuideProfession"
            :options="professionOptions"
          />
          <AppSelect v-model="taskID" :label="ai.modelGuideTask" :options="taskOptions" />
          <AppSelect v-model="language" :label="ai.modelGuideLanguage" :options="languageOptions" />
        </div>
        <ol class="flex flex-col gap-2">
          <li
            v-for="pick in picks"
            :key="pick.id"
            class="flex flex-col gap-1 rounded border border-white/10 p-2 text-xs"
          >
            <div class="flex items-center gap-2">
              <span class="text-muted">{{ pick.rank }}</span>
              <span class="font-medium text-surface">
                {{ pick.steps.map((step) => modelName(step.model)).join(' → ') }}
              </span>
              <AppBadge v-if="pick.steps[0]?.effort">{{ pick.steps[0]?.effort }}</AppBadge>
              <AppBadge>{{ pick.kind }}</AppBadge>
              <span class="ml-auto text-surface">{{ usd(pick.monthly) }}/mo</span>
            </div>
            <ul class="flex flex-wrap gap-x-3 text-[10px] text-muted">
              <li v-for="source in pick.sources.slice(0, 3)" :key="source.label + source.value">
                <a v-if="source.url" :href="source.url" target="_blank" rel="noopener noreferrer">
                  {{ source.label }}: {{ source.value }}
                </a>
                <span v-else>{{ source.label }}: {{ source.value }}</span>
              </li>
            </ul>
          </li>
        </ol>
        <p class="text-[10px] text-muted">{{ ai.modelGuideEdition({ date: edition.asOf }) }}</p>
      </div>
    </AppDialogBody>
  </AppDialogRoot>
</template>

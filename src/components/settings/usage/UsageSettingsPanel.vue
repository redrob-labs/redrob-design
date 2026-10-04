<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from '@redrob-design/vue'

import { diagnostics } from '@/app/diagnostics'
import { isUsageEnabled } from '@/app/diagnostics/settings'
import { summarizeUsage, type UsageSummary } from '@/app/usage'
import SettingsSectionHeader from '@/components/settings/layout/SettingsSectionHeader.vue'
import Stat from '@/components/ui/agent/Stat.vue'

const { diagnostics: diagnosticMessages, settings } = useI18n()
const summary = ref<UsageSummary>(summarizeUsage([]))

async function refresh() {
  summary.value = summarizeUsage(await diagnostics.list())
}

onMounted(() => {
  if (!isUsageEnabled()) return
  void refresh()
})

const unsubscribe = diagnostics.subscribe(() => {
  if (isUsageEnabled()) void refresh()
  else summary.value = summarizeUsage([])
})

onUnmounted(unsubscribe)

function formatTokenValue(value: number | null): string {
  return value === null ? diagnosticMessages.value.usageNotReported : value.toLocaleString()
}
</script>

<template>
  <section class="flex flex-col gap-4" data-test-id="settings-usage-panel">
    <SettingsSectionHeader>
      {{ settings.usage }}
      <template #description>{{ diagnosticMessages.usageDescription }}</template>
    </SettingsSectionHeader>

    <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Stat :label="diagnosticMessages.usageRequests" :value="summary.requests" />
      <Stat :label="diagnosticMessages.usageCompleted" :value="summary.completedRequests" />
      <Stat
        :label="diagnosticMessages.usageInputTokens"
        :value="formatTokenValue(summary.inputTokens)"
      />
      <Stat
        :label="diagnosticMessages.usageOutputTokens"
        :value="formatTokenValue(summary.outputTokens)"
      />
    </div>

    <div class="flex flex-col gap-2">
      <h4 class="text-xs font-semibold text-surface">{{ diagnosticMessages.usageByModel }}</h4>
      <div v-if="summary.models.length === 0" class="text-[11px] text-muted">
        {{ diagnosticMessages.usageNoData }}
      </div>
      <div
        v-for="model in summary.models"
        :key="`${model.provider}-${model.model}`"
        class="flex justify-between text-[11px]"
      >
        <span class="text-muted">{{ model.provider }} · {{ model.model }}</span>
        <span class="text-surface">{{ model.requests }}</span>
      </div>
    </div>

    <p class="text-[10px] text-muted">{{ diagnosticMessages.usageCacheNote }}</p>
  </section>
</template>

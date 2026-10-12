<script setup lang="ts">
import { computed } from 'vue'
import { useInsightsMessages } from '@redrob-design/vue'

import { workModel } from '@/app/ai/insights'

const messages = useInsightsMessages()
const state = workModel.state

const statusText = computed(() => {
  const current = state.value
  switch (current.status) {
    case 'unavailable':
      return messages.value.unavailable
    case 'absent':
      return messages.value.absent
    case 'downloading':
      return messages.value.downloading({ percent: current.percent })
    case 'loading':
      return messages.value.loading
    case 'ready':
      return messages.value.ready
    case 'failed':
      return messages.value.failed({ reason: current.reason })
  }
  return ''
})
</script>

<template>
  <section class="mt-5 border-t border-border pt-4" data-test-id="settings-work-model">
    <div class="mb-2">
      <h3 class="text-xs font-semibold text-surface">{{ messages.title }}</h3>
      <p class="text-[10px] text-muted">{{ messages.description }}</p>
    </div>
    <div class="flex items-center justify-between gap-3 rounded border border-border px-3 py-2">
      <span class="text-[11px] font-medium text-surface">{{ messages.modelLabel }}</span>
      <span
        class="text-right text-[10px] text-muted data-[state=failed]:text-[var(--color-error)] data-[state=ready]:text-[var(--color-success)]"
        :data-state="state.status"
        role="status"
      >
        {{ statusText }}
      </span>
    </div>
  </section>
</template>

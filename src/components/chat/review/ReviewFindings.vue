<script setup lang="ts">
import { computed } from 'vue'

import { useReviewMessages } from '@redrob-design/vue'

import { getActiveEditorStore } from '@/app/editor/active-store'
import { fixFindings, isSettled, openFindings } from '@/app/review/store'
import AppButton from '@/components/ui/AppButton.vue'
import Finding from '@/components/ui/agent/Finding.vue'

import { findingHeading, severityLabel } from './words'

import type { ReviewData, ReviewFinding } from '@/app/review/findings'

/** How many open findings a review shows before "And N more". */
const SHOWN = 4

/** The findings of one page check, each with Fix, and Fix all under them. */
const { messageId, review } = defineProps<{ messageId: string; review: ReviewData }>()

const t = useReviewMessages()
const open = computed(() => openFindings(messageId, review))
const shown = computed(() => open.value.slice(0, SHOWN))
const hidden = computed(() => open.value.length - shown.value.length)
const fixable = computed(() => open.value.filter((finding) => finding.fix))

function fix(findings: readonly ReviewFinding[]): void {
  fixFindings(getActiveEditorStore(), messageId, review, findings)
}

/** Shows where a finding is: the view moves to the layer and outlines it. */
function show(finding: ReviewFinding): void {
  const store = getActiveEditorStore()
  const node = store.graph.getNode(finding.nodeId)
  if (!node) return
  const at = store.graph.getAbsolutePosition(node.id)
  store.zoomToBounds(at.x, at.y, at.x + node.width, at.y + node.height)
  store.setHoveredNode(node.id)
}
</script>

<template>
  <section
    v-if="review.findings.length > 0"
    data-slot="review-findings"
    :aria-label="t.findingsLabel"
    class="flex flex-col gap-2"
  >
    <Finding
      v-for="finding in shown"
      :key="finding.id"
      :severity="finding.severity"
      :severity-label="severityLabel(finding.severity, t)"
      :heading="findingHeading(finding.ruleId, t)"
      :where="finding.where || finding.nodeName"
      :detail="finding.detail"
      :suggestion="finding.suggestion"
      :suggestion-label="t.suggestionLabel"
      :state="isSettled(messageId, finding.id) ? 'accepted' : 'open'"
      :state-label="t.settled"
      openable
      @open="show(finding)"
    >
      <template v-if="finding.fix" #actions>
        <AppButton
          color="neutral"
          variant="outline"
          data-slot="finding-fix"
          @click="fix([finding])"
        >
          {{ t.fix }}
        </AppButton>
      </template>
    </Finding>
    <p v-if="hidden > 0" class="text-xs text-muted">{{ t.andMore({ count: hidden }) }}</p>
    <div v-if="open.length > 0" class="flex flex-wrap items-center gap-2">
      <AppButton
        v-if="fixable.length > 0"
        color="primary"
        variant="solid"
        data-slot="findings-fix-all"
        @click="fix(fixable)"
      >
        {{ t.fixAll({ count: fixable.length }) }}
      </AppButton>
      <span class="text-xs text-muted">{{ t.freeNote }}</span>
    </div>
    <p v-else data-slot="findings-settled" class="flex items-center gap-1.5 text-xs text-muted">
      <icon-lucide-circle-check class="size-3.5 shrink-0 text-success" />
      {{ t.allSettled }}
    </p>
  </section>
</template>

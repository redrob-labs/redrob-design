<script setup lang="ts">
import { computed } from 'vue'

import { useThreadMessages } from '@redrob-design/vue'

import { revealForDisplay } from '@/app/assistant/privacy/store'
import type { CrossCheckData, FactVerdict } from '@/app/assistant/cross-check/types'
import { getActiveEditorStoreOrNull } from '@/app/editor/active-store'
import Finding from '@/components/ui/agent/Finding.vue'
import type { FindingSeverity } from '@/components/ui/agent/types'

/** What Cross-check found on one answer: Fact check findings, then Challenge. */
const { check } = defineProps<{ check: CrossCheckData }>()
const t = useThreadMessages()

const SEVERITY: Record<FactVerdict, FindingSeverity> = {
  unsupported: 'high',
  unclear: 'medium',
  supported: 'note'
}

function shown(text: string): string {
  return revealForDisplay(getActiveEditorStoreOrNull(), text)
}

function verdictLabel(verdict: FactVerdict): string {
  if (verdict === 'unsupported') return t.value.checkUnsupported
  if (verdict === 'unclear') return t.value.checkUnclear
  return t.value.checkSupported
}

/** Problems first, so the one thing to look at is on top. */
const findings = computed(() =>
  [...(check.factCheck ?? [])].sort(
    (a, b) =>
      ['unsupported', 'unclear', 'supported'].indexOf(a.verdict) -
      ['unsupported', 'unclear', 'supported'].indexOf(b.verdict)
  )
)
const by = computed(() => check.by ?? '')
</script>

<template>
  <section data-slot="cross-check" :aria-label="t.crossCheckLabel" class="flex flex-col gap-2">
    <p v-if="check.status === 'failed'" class="text-xs text-error">
      {{ t.checkFailed({ error: check.error ?? '' }) }}
    </p>
    <template v-else>
      <p
        v-if="check.sameCompany"
        data-slot="cross-check-same-company"
        class="rounded-lg border border-warning-border bg-warning-bg px-2.5 py-1.5 text-xs text-warning-text"
      >
        {{ t.checkSameCompany }}
      </p>
      <template v-if="check.factCheck">
        <p class="flex items-center gap-1.5 text-xs text-muted">
          <icon-lucide-shield-check class="size-3.5 shrink-0" />
          {{ t.factCheckBy({ model: by }) }}
        </p>
        <p v-if="findings.length === 0" class="text-xs text-surface">{{ t.checkAllClear }}</p>
        <Finding
          v-for="(finding, i) in findings"
          :key="i"
          :severity="SEVERITY[finding.verdict]"
          :severity-label="verdictLabel(finding.verdict)"
          :heading="shown(finding.claim)"
          :where="finding.where ? shown(finding.where) : undefined"
        />
      </template>
      <template v-if="check.challenge">
        <p class="flex items-center gap-1.5 text-xs text-muted">
          <icon-lucide-swords class="size-3.5 shrink-0" />
          {{ t.challengeBy({ model: by }) }}
        </p>
        <p v-if="check.challenge.rounds.length === 0" class="text-xs text-surface">
          {{ t.challengeNoObjection }}
        </p>
        <ol v-else class="flex flex-col gap-2 text-xs leading-relaxed text-surface">
          <li
            v-for="(round, i) in check.challenge.rounds"
            :key="i"
            class="flex flex-col gap-1 rounded-lg border border-border bg-panel px-2.5 py-2"
          >
            <span class="font-medium text-muted">{{ t.challengeRound({ round: i + 1 }) }}</span>
            <span
              ><b>{{ t.challengeAgainst }}</b> {{ shown(round.objection) }}</span
            >
            <span
              ><b>{{ t.challengeFor }}</b> {{ shown(round.response) }}</span
            >
          </li>
        </ol>
        <p v-if="check.challenge.heldUp" class="text-xs leading-relaxed text-surface">
          <b>{{ t.challengeHeldUp }}</b> {{ shown(check.challenge.heldUp) }}
        </p>
      </template>
    </template>
  </section>
</template>

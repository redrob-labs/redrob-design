import { computed } from 'vue'

import { useComposerMessages } from '@redrob-design/vue'

import { isAgentProvider } from '@/app/ai/chat/storage'
import {
  aiModelSettings,
  isAgentModelProfile,
  resolveAIModelRole,
  setModelRoleAssignment
} from '@/app/ai/models'
import { RANKING_HERE } from '@/app/ai/models/ranking/fixture'
import { profileForPick } from '@/app/ai/models/ranking/profiles'
import { rankedPick, rankedPicks, rankingSource } from '@/app/ai/models/ranking/store'
import type { AssistantControls } from '@/app/assistant/controls/model'
import { privacyLevel } from '@/app/assistant/privacy/store'
import { crossCheckSummary } from '@/components/ui/agent/cross-check'
import type {
  ComposerModeOption,
  ComposerStatusItem,
  CrossCheckDefinition,
  CrossCheckLevelOption,
  MemoryScopeOption,
  PrivacyLevel
} from '@/components/ui/agent/types'

/**
 * Labels, options and status items for the composer bar and the status line
 * under it, bound to one thread's controls.
 */
export function useComposerControls(controls: AssistantControls) {
  const t = useComposerMessages()

  const modeOptions = computed<ComposerModeOption[]>(() => [
    { value: 'plan', label: t.value.modePlan, hint: t.value.modePlanHint },
    { value: 'run', label: t.value.modeRun, hint: t.value.modeRunHint }
  ])

  const crossCheckLevels = computed<CrossCheckLevelOption[]>(() => [
    { value: 'off', label: t.value.levelOff },
    { value: 'auto', label: t.value.levelAuto },
    { value: 'always', label: t.value.levelAlways }
  ])

  const crossChecks = computed<CrossCheckDefinition[]>(() => [
    { id: 'factCheck', name: t.value.factCheck, text: t.value.factCheckText },
    { id: 'challenge', name: t.value.challenge, text: t.value.challengeText }
  ])

  const privacyLevels = computed<PrivacyLevel[]>(() => [
    { id: 'standard', label: t.value.privacyStandard, n: 1, detail: t.value.privacyStandardDetail },
    { id: 'high', label: t.value.privacyHigh, n: 2, detail: t.value.privacyHighDetail },
    { id: 'strict', label: t.value.privacyStrict, n: 3, detail: t.value.privacyStrictDetail }
  ])

  const memoryOptions = computed<MemoryScopeOption[]>(() => [
    {
      value: 'project',
      label: t.value.memoryProduct,
      detail: t.value.memoryProductDetail,
      summary: t.value.memoryProductSummary
    },
    {
      value: 'all',
      label: t.value.memoryAll,
      detail: t.value.memoryAllDetail,
      summary: t.value.memoryAllSummary
    },
    { value: 'none', label: t.value.memoryNone, off: true }
  ])

  const crossCheckValue = computed({
    get: () => ({ ...controls.crossCheck }),
    set: (value: Record<string, 'off' | 'auto' | 'always'>) => {
      controls.crossCheck = {
        factCheck: value.factCheck,
        challenge: value.challenge
      }
    }
  })

  const currentPrivacy = computed(
    () =>
      privacyLevels.value.find((level) => level.id === privacyLevel.value) ?? privacyLevels.value[1]
  )

  /** Local agents read the person's words directly; protection only covers direct models. */
  const privacyItem = computed<ComposerStatusItem>(() =>
    isAgentProvider.value
      ? { id: 'privacy', tone: 'plain', name: t.value.privacy, value: t.value.privacyAgents }
      : {
          id: 'privacy',
          tone: 'safe',
          name: t.value.privacy,
          value: currentPrivacy.value.label,
          level: { n: currentPrivacy.value.n, of: privacyLevels.value.length },
          live: t.value.privacyRunning
        }
  )

  /** Cross-check runs on the Review model, which must be a direct model. */
  const reviewModelReady = computed(() => {
    void aiModelSettings.value
    const review = resolveAIModelRole('review')
    return review !== null && !isAgentModelProfile(review.profile)
  })

  const statusItems = computed<ComposerStatusItem[]>(() => {
    const checksOff =
      controls.crossCheck.factCheck === 'off' && controls.crossCheck.challenge === 'off'
    const missingModel = !checksOff && !reviewModelReady.value
    let checkTone: ComposerStatusItem['tone'] = 'on'
    if (missingModel) checkTone = 'warn'
    else if (checksOff) checkTone = 'plain'
    return [
      privacyItem.value,
      {
        id: 'memory',
        tone: controls.memory === 'none' ? 'plain' : 'on',
        name: t.value.memory,
        value: controls.memory === 'none' ? t.value.memoryOff : t.value.memoryOn
      },
      {
        id: 'check',
        tone: checkTone,
        name: t.value.crossCheck,
        value: missingModel
          ? t.value.crossCheckNoModel
          : crossCheckSummary({ ...controls.crossCheck }, crossCheckLevels.value, {
              off: t.value.levelOff,
              someOn: (on, total) => t.value.someOn({ on, total })
            })
      }
    ]
  })

  /** Pinning a pick that one of your profiles runs makes that profile the Design role. */
  const pickId = computed({
    get: () => controls.pickId,
    set: (id: string | null) => {
      controls.pickId = id
      const pick = rankedPick(id)
      if (!pick) return
      const profile = profileForPick(pick, aiModelSettings.value.models)
      if (profile) setModelRoleAssignment('design', profile.id)
    }
  })

  return {
    t,
    modeOptions,
    crossCheckLevels,
    crossChecks,
    crossCheckValue,
    privacyLevels,
    agentProvider: isAgentProvider,
    reviewModelReady,
    memoryOptions,
    statusItems,
    pickId,
    picks: rankedPicks,
    here: RANKING_HERE,
    source: rankingSource
  }
}

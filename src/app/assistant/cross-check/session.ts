import { generateText, type UIMessage } from 'ai'
import { shallowReactive } from 'vue'

import { createAIModelRuntime } from '@/app/ai/models'
import { changeSetFor } from '@/app/assistant/changes/store'
import { assistantControlsFor } from '@/app/assistant/controls/store'
import { redactText } from '@/app/assistant/privacy/redact'
import { rulesFor } from '@/app/assistant/privacy/rules'
import { privacyLevel, privacyVaultFor, privateTerms } from '@/app/assistant/privacy/store'
import { receiptFor, setReceipt } from '@/app/assistant/thread/store'
import type { TurnOwner } from '@/app/assistant/turn/instructions'
import { designMemoryBrief, designMemorySource } from '@/app/memory/service'

import { answerText, briefFor, describeChanges } from './material'
import type { CheckMaterial } from './prompts'
import { reviewRuntimeOf, runCrossCheck, shouldRun, type CrossCheckDependencies } from './run'
import type { CrossCheckData } from './types'

export const defaultCrossCheckDependencies: CrossCheckDependencies = {
  createRuntime: async () => reviewRuntimeOf(await createAIModelRuntime('review')),
  generate: (options) => generateText(options)
}

let dependencies: CrossCheckDependencies = defaultCrossCheckDependencies

/** The models Cross-check calls; a test transport swaps them so no real model runs. */
export function crossCheckDependencies(): CrossCheckDependencies {
  return dependencies
}

export function setCrossCheckDependencies(next: CrossCheckDependencies | null): void {
  dependencies = next ?? defaultCrossCheckDependencies
}

/** No Review model: nothing is checked and nothing is posted. */
export const NO_REVIEW_MODEL: CrossCheckDependencies = {
  createRuntime: () => Promise.resolve(null),
  generate: () => Promise.reject(new Error('No Review model'))
}

let checkCount = 0

/** Answers being cross-checked right now, by message id. */
export const crossChecksRunning = shallowReactive(new Set<string>())

/** The review model is a direct model too: it reads the same placeholders. */
function protect(owner: object, material: CheckMaterial): CheckMaterial {
  const rules = rulesFor(privacyLevel.value, privateTerms.value)
  const vault = privacyVaultFor(owner)
  const hide = (text: string) => redactText(text, rules, vault).text
  return {
    brief: hide(material.brief),
    answer: hide(material.answer),
    changes: material.changes.map(hide),
    memory: material.memory
  }
}

/**
 * Runs Cross-check on one finished answer when the person's levels call for
 * it, records the checker on the receipt, and returns the message to post.
 * Null when nothing ran or there is nothing new to say.
 */
export async function crossCheckAnswer(
  store: TurnOwner,
  message: UIMessage,
  messages: readonly UIMessage[],
  using: CrossCheckDependencies = dependencies
): Promise<UIMessage | null> {
  if (message.role !== 'assistant') return null
  const controls = assistantControlsFor(store)
  const changeSet = changeSetFor(message.id)
  const factCheck = shouldRun(controls.crossCheck.factCheck, changeSet !== null)
  const challenge = shouldRun(controls.crossCheck.challenge, changeSet !== null)
  if (!factCheck && !challenge) return null

  const receipt = receiptFor(message.id)
  const memory =
    controls.memory === 'none'
      ? ''
      : designMemoryBrief(designMemorySource().read(store.graph, store.state.documentName))
  const material = protect(store, {
    brief: briefFor(messages, message.id),
    answer: answerText(message),
    changes: changeSet ? describeChanges(changeSet.items, store.graph) : [],
    memory
  })

  crossChecksRunning.add(message.id)
  let data: CrossCheckData
  try {
    data = await runCrossCheck(
      {
        answerId: message.id,
        material,
        factCheck,
        challenge,
        drewWith: { provider: receipt?.provider ?? '', model: receipt?.model ?? '' }
      },
      using
    )
  } finally {
    crossChecksRunning.delete(message.id)
  }
  // The composer's Cross-check status says a Review model is missing; the thread stays quiet.
  if (data.status === 'no-model') return null
  if (data.status === 'done' && data.factCheck && data.by && receipt) {
    setReceipt(message.id, { ...receipt, factCheckBy: data.by })
  }
  return {
    id: `check-${Date.now()}-${++checkCount}`,
    role: 'assistant',
    parts: [{ type: 'data-cross-check', data }]
  }
}

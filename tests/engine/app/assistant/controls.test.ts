import { describe, expect, test } from 'bun:test'

import { DESIGN_SCREENS_RANKING, RANKING_HERE } from '@/app/ai/models/ranking/fixture'
import { profileForPick } from '@/app/ai/models/ranking/profiles'
import {
  DEFAULT_ASSISTANT_CONTROLS,
  normalizeAssistantControls
} from '@/app/assistant/controls/model'
import { crossCheckSummary } from '@/components/ui/agent/cross-check'

const LEVELS = [
  { value: 'off', label: 'Off' },
  { value: 'auto', label: 'When it matters' },
  { value: 'always', label: 'Always' }
] as const
const WORDS = { off: 'Off', someOn: (on: number, total: number) => `${on} of ${total} on` }

describe('cross-check summary', () => {
  test('names the shared level', () => {
    expect(crossCheckSummary({ factCheck: 'auto', challenge: 'auto' }, LEVELS, WORDS)).toBe(
      'When it matters'
    )
  })
  test('counts checks that are on when they differ', () => {
    expect(crossCheckSummary({ factCheck: 'always', challenge: 'auto' }, LEVELS, WORDS)).toBe(
      '2 of 2 on'
    )
    expect(crossCheckSummary({ factCheck: 'always', challenge: 'off' }, LEVELS, WORDS)).toBe(
      '1 of 2 on'
    )
  })
  test('says Off when every check is off', () => {
    expect(crossCheckSummary({ factCheck: 'off', challenge: 'off' }, LEVELS, WORDS)).toBe('Off')
  })
})

describe('assistant controls', () => {
  test('start on Plan, Redrob Auto, product memory and the default checks', () => {
    expect(normalizeAssistantControls(null)).toEqual(DEFAULT_ASSISTANT_CONTROLS)
  })
  test('keep valid stored choices and drop the rest', () => {
    expect(
      normalizeAssistantControls({
        mode: 'run',
        pickId: 'screens-2',
        effort: 2,
        memory: 'nope',
        crossCheck: { factCheck: 'off', challenge: 'sometimes' }
      })
    ).toEqual({
      mode: 'run',
      pickId: 'screens-2',
      effort: 2,
      memory: 'project',
      crossCheck: { factCheck: 'off', challenge: 'auto' }
    })
  })
  test('reject a non-integer effort', () => {
    expect(normalizeAssistantControls({ effort: 1.5 }).effort).toBeNull()
  })
})

describe('model ranking', () => {
  test('lists five picks, with those that run elsewhere marked by harness', () => {
    expect(DESIGN_SCREENS_RANKING).toHaveLength(5)
    expect(DESIGN_SCREENS_RANKING.filter((pick) => pick.harness !== RANKING_HERE)).toHaveLength(2)
  })
  test('drops the Pro level outside ChatGPT', () => {
    const astra = DESIGN_SCREENS_RANKING.find((pick) => pick.id === 'screens-3')
    const opus = DESIGN_SCREENS_RANKING.find((pick) => pick.id === 'screens-1')
    expect(astra?.efforts?.some((level) => level.label === 'Pro')).toBe(true)
    expect(opus?.efforts?.map((level) => level.label)).toEqual([
      'Low',
      'Medium',
      'High',
      'Extra high',
      'Max'
    ])
  })
  test('pins a pick to the profile that runs that model', () => {
    const opus = DESIGN_SCREENS_RANKING[0]
    const profiles = [
      { id: 'a', name: 'Fast', modelID: 'gpt-5-mini', customModelID: '' },
      { id: 'b', name: 'Main', modelID: 'anthropic/claude-opus-5.5', customModelID: '' }
    ]
    expect(profileForPick(opus, profiles)?.id).toBe('b')
    expect(profileForPick(DESIGN_SCREENS_RANKING[1], profiles)).toBeNull()
  })
})

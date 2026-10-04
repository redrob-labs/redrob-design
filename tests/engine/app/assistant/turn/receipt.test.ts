import { describe, expect, test } from 'bun:test'

import { priceTurn, rateForModel } from '@/app/assistant/turn/pricing'
import { createTurnAccumulator } from '@/app/assistant/turn/usage'

describe('turn pricing', () => {
  test('matches the most specific listed model first', () => {
    expect(rateForModel('openai/gpt-4o-mini')?.match).toBe('gpt-4o-mini')
    expect(rateForModel('GPT-4o')?.match).toBe('gpt-4o')
    expect(rateForModel('claude-sonnet-4')?.match).toBe('sonnet')
  })

  test('prices a turn per million tokens', () => {
    expect(priceTurn('claude-sonnet-4', 1_000_000, 100_000)).toBeCloseTo(4.5)
  })

  test('reports no price for unknown models or missing usage', () => {
    expect(priceTurn('some-local-model', 10, 10)).toBeNull()
    expect(priceTurn('claude-sonnet-4', null, 10)).toBeNull()
  })
})

describe('turn accumulator', () => {
  test('adds every model step of a turn into one receipt', () => {
    const turn = createTurnAccumulator()
    turn.addStep({
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      inputTokens: 1000,
      outputTokens: 200
    })
    turn.addStep({
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      inputTokens: 1500,
      outputTokens: 300
    })
    const receipt = turn.finish({ effort: null, pinned: false })
    expect(receipt).toMatchObject({
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      pinned: false,
      inputTokens: 2500,
      outputTokens: 500,
      steps: 2
    })
    expect(receipt?.price).toBeCloseTo((2500 * 3 + 500 * 15) / 1_000_000)
    expect(turn.stepCount).toBe(0)
  })

  test('keeps token counts unknown when no step reported them', () => {
    const turn = createTurnAccumulator()
    turn.addStep({ provider: 'acp', model: 'agent', inputTokens: null, outputTokens: null })
    const receipt = turn.finish({ effort: 'High', pinned: true })
    expect(receipt?.inputTokens).toBeNull()
    expect(receipt?.price).toBeNull()
    expect(receipt?.effort).toBe('High')
  })

  test('has no receipt when no model step ran', () => {
    expect(createTurnAccumulator().finish({ effort: null, pinned: false })).toBeNull()
  })
})

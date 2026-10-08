import { describe, expect, test } from 'bun:test'

import type { UIMessage } from 'ai'

import type { TurnReceipt } from '@/app/assistant/turn/usage'
import { formatPrice, receiptItems } from '@/components/chat/receipt/items'
import { humanToolName, turnSteps } from '@/components/chat/timeline/steps'

const words = {
  byAuto: 'by Redrob Auto',
  yourChoice: 'your choice',
  free: 'Free',
  priceUnknown: 'Price not reported',
  private: 'Private',
  keptPrivate: (count: number) => `${count} kept private`,
  factCheck: 'Fact check'
}

const base: TurnReceipt = {
  provider: 'anthropic',
  model: 'claude-sonnet-4',
  effort: null,
  pinned: false,
  inputTokens: 10,
  outputTokens: 5,
  steps: 1,
  price: 0.0001,
  keptPrivate: 0,
  factCheckBy: null
}

describe('answer receipt items', () => {
  test('name the model, who chose it, the price and privacy', () => {
    const items = receiptItems(base, words, 'en')
    expect(items.map((item) => item.id)).toEqual(['model', 'price', 'privacy'])
    expect(items[0]).toMatchObject({
      icon: 'auto',
      label: 'claude-sonnet-4',
      sub: 'by Redrob Auto'
    })
    expect(items[1].label).toBe('$0.01')
    expect(items[2].label).toBe('Private')
  })

  test('show a pinned model with its effort and add Fact check when it ran', () => {
    const items = receiptItems(
      { ...base, pinned: true, effort: 'High', keptPrivate: 2, factCheckBy: 'gpt-4o' },
      words,
      'en'
    )
    expect(items[0]).toMatchObject({ icon: 'pin', sub: 'High' })
    expect(items[2].label).toBe('2 kept private')
    expect(items[3]).toMatchObject({ id: 'check', label: 'Fact check', sub: 'gpt-4o' })
  })

  test('say when the price is not reported or free', () => {
    expect(receiptItems({ ...base, price: null }, words, 'en')[1].label).toBe('Price not reported')
    expect(receiptItems({ ...base, price: 0 }, words, 'en')[1].label).toBe('Free')
  })

  test('never show a paid answer as costing nothing', () => {
    expect(formatPrice(0.0004, 'en')).toBe('$0.01')
    expect(formatPrice(1.234, 'en')).toBe('$1.23')
  })
})

describe('turn progress steps', () => {
  const stepWords = {
    stepReading: 'Reading',
    stepWorking: 'Working',
    stepAnswering: 'Answering',
    stepTool: (tool: string) => `Used ${tool}`
  }

  test('reads the message before any answer arrives', () => {
    expect(turnSteps(null, stepWords)).toEqual([
      { id: 'reading', label: 'Reading', state: 'active' }
    ])
  })

  test('lists each tool and then the answer', () => {
    const answer = {
      id: 'a',
      role: 'assistant',
      parts: [
        {
          type: 'tool-create_frame',
          toolCallId: 't1',
          state: 'output-available',
          input: {},
          output: {}
        },
        { type: 'text', text: 'Done' }
      ]
    } as UIMessage
    expect(turnSteps(answer, stepWords).map((step) => [step.label, step.state])).toEqual([
      ['Reading', 'done'],
      ['Used Create frame', 'done'],
      ['Answering', 'active']
    ])
  })

  test('humanizes MCP tool names', () => {
    expect(humanToolName('mcp__redrob__set_fill')).toBe('Set fill')
  })
})

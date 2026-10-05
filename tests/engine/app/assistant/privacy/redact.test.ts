import { describe, expect, test } from 'bun:test'

import type { ModelMessage } from 'ai'

import { redactModelMessages } from '@/app/assistant/privacy/messages'
import {
  concealKnownText,
  createPrivacyVault,
  redactText,
  revealText
} from '@/app/assistant/privacy/redact'
import { passesIBANCheck, passesLuhn, rulesFor } from '@/app/assistant/privacy/rules'
import { protectTools } from '@/app/assistant/privacy/tools'
import { createTurnAccumulator } from '@/app/assistant/turn/usage'

function redact(
  text: string,
  level: 'standard' | 'high' | 'strict' = 'high',
  terms: string[] = []
) {
  return redactText(text, rulesFor(level, terms), createPrivacyVault()).text
}

describe('privacy rules', () => {
  test('email addresses from High up', () => {
    expect(redact('email jane@example.com about pricing')).toBe('email [EMAIL_1] about pricing')
    expect(redact('email jane@example.com', 'standard')).toBe('email jane@example.com')
  })

  test('phone numbers, but not prices, sizes or dates', () => {
    expect(redact('call +1 415 555 0134 today')).toBe('call [PHONE_1] today')
    expect(redact('call 415-555-0134')).toBe('call [PHONE_1]')
    expect(redact('Team is $24 a month, frame 1440 900, due 2026-10-06')).toBe(
      'Team is $24 a month, frame 1440 900, due 2026-10-06'
    )
  })

  test('card numbers that pass Luhn, not other long numbers', () => {
    expect(passesLuhn('4242 4242 4242 4242')).toBe(true)
    expect(passesLuhn('4242 4242 4242 4241')).toBe(false)
    expect(redact('card 4242 4242 4242 4242', 'standard')).toBe('card [CARD_1]')
    expect(redact('order 4242 4242 4242 4241', 'standard')).toBe('order 4242 4242 4242 4241')
  })

  test('IBANs that pass the mod-97 check', () => {
    expect(passesIBANCheck('GB82 WEST 1234 5698 7654 32')).toBe(true)
    expect(passesIBANCheck('GB82 WEST 1234 5698 7654 33')).toBe(false)
    expect(redact('pay GB82WEST12345698765432', 'standard')).toBe('pay [IBAN_1]')
  })

  test('secret keys by prefix at every level, random tokens from High up', () => {
    expect(redact('key sk-ant-REDACTEDREDACTEDREDACTED', 'standard')).toBe('key [KEY_1]')
    expect(redact('key AKIAIOSFODNN7EXAMPLE', 'standard')).toBe('key [KEY_1]')
    const token = 'q8Zr2LmX7vB4nT9kP1wY6sD3fH5jG0cE'
    expect(redact(`token ${token}`)).toBe('token [KEY_1]')
    expect(redact(`token ${token}`, 'standard')).toBe(`token ${token}`)
  })

  test('leaves design words and class names alone', () => {
    const text = 'Make bg-(--action-primary) buttons 44px, Pretendard 16/24, radius 12'
    expect(redact(text, 'strict')).toBe(text)
  })

  test('listed names from High up, whole words only', () => {
    expect(redact('Ask Jane Doe about Janet', 'high', ['Jane Doe', 'Jane'])).toBe(
      'Ask [NAME_1] about Janet'
    )
    expect(redact('Ask Jane', 'standard', ['Jane'])).toBe('Ask Jane')
  })

  test('Strict also takes long numbers and web addresses with details', () => {
    expect(redact('account 12345678', 'strict')).toBe('account [NUMBER_1]')
    expect(redact('see https://a.example/p?user=42 now', 'strict')).toBe('see [URL_1] now')
    expect(redact('account 12345678')).toBe('account 12345678')
  })
})

describe('privacy vault', () => {
  test('one value keeps one placeholder and reveals back', () => {
    const vault = createPrivacyVault()
    const rules = rulesFor('high')
    const first = redactText('jane@example.com and bob@example.com', rules, vault)
    const again = redactText('again jane@example.com', rules, vault)
    expect(first.text).toBe('[EMAIL_1] and [EMAIL_2]')
    expect(again.text).toBe('again [EMAIL_1]')
    expect(revealText('Wrote to [EMAIL_2] and [EMAIL_9]', vault)).toBe(
      'Wrote to bob@example.com and [EMAIL_9]'
    )
    expect(concealKnownText('Canvas says jane@example.com', vault)).toBe('Canvas says [EMAIL_1]')
  })
})

describe('direct-model requests', () => {
  test('only the person words are redacted, and the count is distinct values', () => {
    const vault = createPrivacyVault()
    const messages: ModelMessage[] = [
      { role: 'user', content: 'Email jane@example.com' },
      { role: 'assistant', content: 'Sure, [EMAIL_1].' },
      {
        role: 'user',
        content: [{ type: 'text', text: 'Also jane@example.com and +44 20 7946 0958' }]
      }
    ]
    const result = redactModelMessages(messages, rulesFor('high'), vault)
    expect(JSON.stringify(result.messages)).not.toContain('jane@example.com')
    expect(JSON.stringify(result.messages)).not.toContain('7946')
    expect(result.messages[1]).toEqual(messages[1])
    expect(result.keptPrivate).toBe(2)
  })

  test('tools run with real values and return placeholders', async () => {
    const vault = createPrivacyVault()
    redactText('jane@example.com', rulesFor('high'), vault)
    const seen: unknown[] = []
    const tools = protectTools(
      {
        set_text: {
          description: 'x',
          execute: async (input: { text: string }) => {
            seen.push(input)
            return { written: input.text, ids: ['1:2'] }
          }
        }
      },
      () => vault
    )
    const result = await tools.set_text.execute?.({ text: 'Contact [EMAIL_1]' }, {})
    expect(seen).toEqual([{ text: 'Contact jane@example.com' }])
    expect(result).toEqual({ written: 'Contact [EMAIL_1]', ids: ['1:2'] })
  })

  test('the receipt counts what was kept private', () => {
    const turn = createTurnAccumulator()
    turn.setKeptPrivate(1)
    turn.addStep({ provider: 'p', model: 'm', inputTokens: 1, outputTokens: 1 })
    expect(turn.finish({ effort: null, pinned: false })?.keptPrivate).toBe(1)
    turn.addStep({ provider: 'p', model: 'm', inputTokens: 1, outputTokens: 1 })
    expect(turn.finish({ effort: null, pinned: false })?.keptPrivate).toBe(0)
  })
})

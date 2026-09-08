import { describe, expect, test } from 'bun:test'

import { normalizeRedrobCodeModelId, REDROB_CODE_DEFAULT_MODEL } from '@/app/ai/acp/model'

describe('normalizeRedrobCodeModelId', () => {
  test('empty and Design aliases become redrob/auto', () => {
    expect(normalizeRedrobCodeModelId(undefined)).toBe(REDROB_CODE_DEFAULT_MODEL)
    expect(normalizeRedrobCodeModelId('')).toBe(REDROB_CODE_DEFAULT_MODEL)
    expect(normalizeRedrobCodeModelId('design.genie')).toBe(REDROB_CODE_DEFAULT_MODEL)
    expect(normalizeRedrobCodeModelId('Genie')).toBe(REDROB_CODE_DEFAULT_MODEL)
    expect(normalizeRedrobCodeModelId('auto')).toBe(REDROB_CODE_DEFAULT_MODEL)
  })

  test('bare console ids are prefixed with redrob/', () => {
    expect(normalizeRedrobCodeModelId('claude-sonnet-5')).toBe('redrob/claude-sonnet-5')
  })

  test('provider/model ids pass through', () => {
    expect(normalizeRedrobCodeModelId('redrob/auto')).toBe(REDROB_CODE_DEFAULT_MODEL)
    expect(normalizeRedrobCodeModelId('redrob/claude-opus-5')).toBe('redrob/claude-opus-5')
  })
})

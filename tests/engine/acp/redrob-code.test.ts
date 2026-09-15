import { describe, expect, test } from 'bun:test'

import {
  ACP_AGENTS,
  DEFAULT_AI_PROVIDER,
  REDROB_CODE_AGENT_ID,
  REDROB_CODE_INSTALL_COMMAND,
  REDROB_CODE_PROVIDER_ID,
  redrobCodeMissingMessage,
  resolveRedrobCodeCommand
} from '@redrob-design/core/constants'

import { missingCommandMessage } from '@/app/ai/acp/transport'
import { resolveAIModelRole } from '@/app/ai/models/store'

function requireAgent(id: string) {
  const agent = ACP_AGENTS.find((candidate) => candidate.id === id)
  if (!agent) throw new Error(`Expected ACP agent "${id}" to be registered`)
  return agent
}

describe('resolveRedrobCodeCommand', () => {
  test('prefers REDROB_CODE_BIN when set', () => {
    const resolved = resolveRedrobCodeCommand({ REDROB_CODE_BIN: '/opt/redrob/bin/redrob' })
    expect(resolved).toEqual({
      command: '/opt/redrob/bin/redrob',
      args: [],
      source: 'REDROB_CODE_BIN'
    })
  })

  test('trims whitespace around REDROB_CODE_BIN', () => {
    const resolved = resolveRedrobCodeCommand({ REDROB_CODE_BIN: '  /usr/local/bin/redrob  ' })
    expect(resolved.command).toBe('/usr/local/bin/redrob')
    expect(resolved.source).toBe('REDROB_CODE_BIN')
  })

  test('falls back to a bun-run source checkout via REDROB_CODE_DEV_ROOT', () => {
    const resolved = resolveRedrobCodeCommand({ REDROB_CODE_DEV_ROOT: '/src/redrob-code' })
    expect(resolved).toEqual({
      command: 'bun',
      args: ['run', '/src/redrob-code/packages/redrob/src/index.ts'],
      source: 'REDROB_CODE_DEV_ROOT'
    })
  })

  test('honors a custom bun binary for the dev-root path', () => {
    const resolved = resolveRedrobCodeCommand({
      REDROB_CODE_DEV_ROOT: '/src/redrob-code',
      REDROB_CODE_BUN: '/opt/bun/bin/bun'
    })
    expect(resolved.command).toBe('/opt/bun/bin/bun')
    expect(resolved.source).toBe('REDROB_CODE_DEV_ROOT')
  })

  test('REDROB_CODE_BIN wins over REDROB_CODE_DEV_ROOT', () => {
    const resolved = resolveRedrobCodeCommand({
      REDROB_CODE_BIN: '/opt/redrob/bin/redrob',
      REDROB_CODE_DEV_ROOT: '/src/redrob-code'
    })
    expect(resolved.source).toBe('REDROB_CODE_BIN')
  })

  test('defaults to the redrob binary on PATH with no env', () => {
    const resolved = resolveRedrobCodeCommand({})
    expect(resolved).toEqual({ command: 'redrob', args: [], source: 'PATH' })
  })

  test('treats blank env values as unset and falls back to PATH', () => {
    const resolved = resolveRedrobCodeCommand({ REDROB_CODE_BIN: '   ', REDROB_CODE_DEV_ROOT: '' })
    expect(resolved.source).toBe('PATH')
    expect(resolved.command).toBe('redrob')
  })
})

describe('redrobCodeMissingMessage (guide to install)', () => {
  test('names the engine and the supported install command', () => {
    const message = redrobCodeMissingMessage()
    expect(message).toContain('Redrob Design runs on the Redrob Code engine')
    expect(message).toContain(REDROB_CODE_INSTALL_COMMAND)
    expect(message).toContain('curl -fsSL https://code.redrob.ai/install | bash')
    expect(message).toContain('REDROB_CODE_BIN')
  })

  test('does not suggest falling back to another provider', () => {
    const message = redrobCodeMissingMessage().toLowerCase()
    expect(message).not.toContain('openrouter')
    expect(message).not.toContain('anthropic')
    expect(message).not.toContain('openai')
  })

  test('folds a supplied reason into the guidance', () => {
    const message = redrobCodeMissingMessage('"redrob" was not found.')
    expect(message).toContain('"redrob" was not found.')
    expect(message).toContain(REDROB_CODE_INSTALL_COMMAND)
  })

  test('omits an empty reason cleanly', () => {
    expect(redrobCodeMissingMessage('   ')).toBe(redrobCodeMissingMessage())
  })
})

describe('missingCommandMessage surfaces the Redrob guidance for the engine', () => {
  const redrobAgent = requireAgent(REDROB_CODE_AGENT_ID)

  test('the Redrob Code agent shows the guide-to-install message', () => {
    const message = missingCommandMessage(redrobAgent)
    expect(message).toContain('Redrob Design runs on the Redrob Code engine')
    expect(message).toContain(REDROB_CODE_INSTALL_COMMAND)
  })

  test('other agents keep the generic install notice', () => {
    const claude = requireAgent('claude-code')
    const message = missingCommandMessage(claude)
    expect(message).toBe(
      '"claude-agent-acp" is not installed. Install it with: npm i -g @agentclientprotocol/claude-agent-acp'
    )
  })
})

describe('acp:redrob-code registration + default Design agent', () => {
  test('Redrob Code is a registered ACP agent', () => {
    const redrobAgent = requireAgent(REDROB_CODE_AGENT_ID)
    expect(redrobAgent.name).toBe('Redrob Code')
    expect(redrobAgent.installCommand).toBe(REDROB_CODE_INSTALL_COMMAND)
  })

  test('its resolved command is the redrob binary by default', () => {
    const redrobAgent = requireAgent(REDROB_CODE_AGENT_ID)
    // The sandbox has no REDROB_CODE_BIN/DEV_ROOT override, so it resolves to PATH.
    expect(redrobAgent.command).toBe('redrob')
    expect(redrobAgent.args).toEqual([])
  })

  test('the provider ID is acp:redrob-code', () => {
    expect(REDROB_CODE_PROVIDER_ID).toBe('acp:redrob-code')
    expect(REDROB_CODE_PROVIDER_ID).toBe(`acp:${REDROB_CODE_AGENT_ID}`)
  })

  test('Redrob Code is the default AI provider', () => {
    expect(DEFAULT_AI_PROVIDER).toBe(REDROB_CODE_PROVIDER_ID)
  })

  test('the Design agent role defaults to acp:redrob-code on a fresh install', () => {
    const role = resolveAIModelRole('design')
    expect(role).not.toBeNull()
    expect(role?.connection.providerID).toBe(REDROB_CODE_PROVIDER_ID)
    // ACP design agents drive the editor tools, so the profile must support tools.
    expect(role?.profile.capabilities).toContain('tools')
  })
})

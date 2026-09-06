import { describe, expect, test } from 'bun:test'

import { devAutomationRoute } from '@/app/automation/bridge/portless-route'

describe('Portless MCP routing', () => {
  test('uses the fixed localhost bridge outside Portless', () => {
    expect(devAutomationRoute(undefined, 7600)).toEqual({
      browserURL: 'ws://127.0.0.1:7600',
      corsOrigin: 'http://localhost:1420',
      portlessServiceName: null,
      runtimeId: 'localhost-7600'
    })
  })

  test('derives a sibling MCP service for the main checkout', () => {
    expect(devAutomationRoute('https://redrob-design.localhost', 7600)).toEqual({
      browserURL: 'wss://mcp.redrob-design.localhost',
      corsOrigin: 'https://redrob-design.localhost',
      portlessServiceName: 'mcp.redrob-design',
      runtimeId: 'mcp.redrob-design.localhost'
    })
  })

  test('preserves the worktree prefix for the MCP service', () => {
    expect(
      devAutomationRoute('https://portless-mcp-routing.redrob-design.localhost', 7600)
    ).toEqual({
      browserURL: 'wss://portless-mcp-routing.mcp.redrob-design.localhost',
      corsOrigin: 'https://portless-mcp-routing.redrob-design.localhost',
      portlessServiceName: 'mcp.redrob-design',
      runtimeId: 'portless-mcp-routing.mcp.redrob-design.localhost'
    })
  })

  test('rejects unrelated Portless hostnames', () => {
    expect(() => devAutomationRoute('https://other.localhost', 7600)).toThrow(
      'Unexpected Redrob Design Portless URL'
    )
  })
})

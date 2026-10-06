import { mcpRuntime, refreshMCPRuntime } from '@/app/automation/mcp/runtime'
import { demoMode } from '@/app/runtime/demo'

export interface HandoffConnection {
  refresh: () => Promise<unknown>
  state: { status: string; clientSessions: number }
}

const appConnection: HandoffConnection = { refresh: refreshMCPRuntime, state: mcpRuntime }

/**
 * Whether an agent such as Claude Code is connected to the local MCP server
 * right now. The server only counts sessions; it cannot tell which agent.
 */
export async function agentConnected(
  connection: HandoffConnection = appConnection
): Promise<boolean> {
  if (demoMode.value) return true
  await connection.refresh()
  return connection.state.status === 'running' && connection.state.clientSessions > 0
}

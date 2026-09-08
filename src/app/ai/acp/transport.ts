import { ClientSideConnection, ndJsonStream, PROTOCOL_VERSION } from '@agentclientprotocol/sdk'
import type {
  Client,
  Agent,
  SessionNotification,
  RequestPermissionRequest,
  RequestPermissionResponse
} from '@agentclientprotocol/sdk'
import type { ChatTransport, UIMessage, UIMessageChunk } from 'ai'

import {
  REDROB_CODE_AGENT_ID,
  redrobCodeMissingMessage,
  type ACPAgentDef
} from '@redrob-design/core/constants'

import { formatUnknownError } from '@/app/ai/chat/failure'
import SYSTEM_PROMPT from '@/app/ai/chat/system-prompt.md?raw'
import { describeDiagnosticError, recordACPTransportFailure } from '@/app/diagnostics'
import { buildACPMCPServers } from '@/app/integrations/mcp'

import { mapUpdate } from './map-update'
import { normalizeRedrobCodeModelId } from './model'
import { spawnACPProcess } from './process'

type TauriChild = Awaited<ReturnType<typeof spawnACPProcess>>['child']

interface ACPDebugEntry {
  ts: number
  type: string
  data: unknown
}

interface ACPSession {
  connection: ClientSideConnection
  sessionId: string
  child: TauriChild
  onUpdate: ((params: SessionNotification) => void) | null
  dead: boolean
}

const MAX_LOG_AGE_MS = 5 * 60 * 1000
const IS_DEV = import.meta.env.DEV

const acpDebugLog: ACPDebugEntry[] = []

function pruneOldEntries() {
  const cutoff = Date.now() - MAX_LOG_AGE_MS
  while (acpDebugLog.length > 0 && acpDebugLog[0].ts < cutoff) {
    acpDebugLog.shift()
  }
}

export function getACPDebugText(): string {
  pruneOldEntries()
  return acpDebugLog
    .map((e) => `[${new Date(e.ts).toISOString()}] ${e.type}\n${JSON.stringify(e.data, null, 2)}`)
    .join('\n\n---\n\n')
}

export function clearACPDebugLog() {
  acpDebugLog.length = 0
}

export function hasACPDebugEntries(): boolean {
  pruneOldEntries()
  return acpDebugLog.length > 0
}

function isMissingCommandError(message: string): boolean {
  const normalized = message.toLowerCase()
  return normalized.includes('enoent') || normalized.includes('program not found')
}

export function missingCommandMessage(agentDef?: ACPAgentDef): string {
  if (!agentDef) return 'ACP agent CLI is not installed.'
  // Redrob Code is the engine Redrob Design runs on, so a missing engine is a
  // setup problem to guide through, not a generic CLI-not-found notice.
  if (agentDef.id === REDROB_CODE_AGENT_ID) {
    return redrobCodeMissingMessage(`"${agentDef.command}" was not found.`)
  }
  if (!agentDef.installCommand) {
    return `"${agentDef.command}" is not installed. Install it and restart Redrob Design.`
  }
  return `"${agentDef.command}" is not installed. Install it with: ${agentDef.installCommand}`
}

export function formatConnectionError(e: unknown, agentDef?: ACPAgentDef): string {
  const msg = formatUnknownError(e)
  if (
    msg.includes('ECONNREFUSED') ||
    msg.includes('fetch failed') ||
    msg.includes('Failed to fetch')
  ) {
    return 'MCP server is not running. Make sure the editor is open.'
  }
  if (msg.includes('timeout') || msg.includes('Timeout') || msg.includes('ETIMEDOUT')) {
    return 'MCP server did not respond in time.'
  }
  if (isMissingCommandError(msg)) {
    return missingCommandMessage(agentDef)
  }
  if (
    msg.toLowerCase().includes('authentication required') ||
    msg.toLowerCase().includes('provider authentication')
  ) {
    return 'Redrob Code needs a Console API key. Set REDROB_API_KEY (or REDROB_KEY) and restart.'
  }
  return msg
}

function startupError(error: unknown, agentDef: ACPAgentDef): Error {
  recordACPTransportFailure({ operation: 'start', ...describeDiagnosticError(error) })
  return new Error(formatConnectionError(error, agentDef))
}

export function buildCrashChunks(
  destroying: boolean,
  textId: string,
  textStarted: boolean
): { chunks: UIMessageChunk[]; shouldNullSession: boolean } {
  if (destroying) return { chunks: [], shouldNullSession: false }
  const chunks: UIMessageChunk[] = []
  if (textStarted) chunks.push({ type: 'text-end', id: textId })
  chunks.push({ type: 'error', errorText: 'Agent process exited unexpectedly.' })
  chunks.push({ type: 'finish-step' })
  chunks.push({ type: 'finish', finishReason: 'error' })
  return { chunks, shouldNullSession: true }
}

export class ACPChatTransport implements ChatTransport<UIMessage> {
  private session: ACPSession | null = null
  private agentDef: ACPAgentDef
  private cwd: string
  private modelId: string
  private sentContext = false
  private destroying = false

  constructor(options: { agentDef: ACPAgentDef; cwd?: string; modelId?: string }) {
    this.agentDef = options.agentDef
    this.cwd = options.cwd ?? '.'
    this.modelId =
      options.agentDef.id === REDROB_CODE_AGENT_ID
        ? normalizeRedrobCodeModelId(options.modelId)
        : (options.modelId?.trim() ?? '')
  }

  async sendMessages({
    messages,
    abortSignal
  }: Parameters<ChatTransport<UIMessage>['sendMessages']>[0]): Promise<
    ReadableStream<UIMessageChunk>
  > {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')
    const text =
      lastUserMessage?.parts
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join('\n') ?? ''

    if (this.session?.dead) {
      this.session = null
    }

    if (!this.session) {
      this.session = await this.spawnAgent()
    }

    const promptText = this.sentContext ? text : `${SYSTEM_PROMPT}\n\n${text}`
    this.sentContext = true

    const { connection, sessionId } = this.session
    const session = this.session

    return new ReadableStream<UIMessageChunk>({
      start: (controller) => {
        const textId = `text-${Date.now()}`
        let textStarted = false
        let closed = false

        function finish(reason: 'stop' | 'other' | 'error', errorText?: string) {
          if (closed) return
          closed = true
          if (errorText) controller.enqueue({ type: 'error', errorText })
          if (textStarted) controller.enqueue({ type: 'text-end', id: textId })
          controller.enqueue({ type: 'finish-step' })
          controller.enqueue({ type: 'finish', finishReason: reason })
          session.onUpdate = null
          controller.close()
        }

        session.onUpdate = (params) => {
          if (closed) return
          if (IS_DEV) {
            acpDebugLog.push({
              ts: Date.now(),
              type: params.update.sessionUpdate,
              data: params.update
            })
          }
          const result = mapUpdate(params.update, textId, textStarted)
          for (const chunk of result.chunks) {
            controller.enqueue(chunk)
          }
          textStarted = result.textStarted
        }

        abortSignal?.addEventListener('abort', () => {
          void connection.cancel({ sessionId })
          finish('stop')
        })

        controller.enqueue({ type: 'start' })
        controller.enqueue({ type: 'start-step' })

        connection
          .prompt({
            sessionId,
            prompt: [{ type: 'text', text: promptText }]
          })
          .then(() => {
            // ACP prompt resolution is the turn boundary: close the chat stream so
            // the UI leaves the streaming/submitted state after tool+text updates.
            return finish('stop')
          })
          .catch((e) => {
            // #region agent log
            {
              void import('./debug-log').then(({ agentDebugLog }) =>
                agentDebugLog({
                  hypothesisId: 'C',
                  location: 'acp/transport.ts:prompt',
                  message: 'ACP prompt failed',
                  data: {
                    agentId: this.agentDef.id,
                    modelId: this.modelId,
                    error: formatUnknownError(e)
                  }
                })
              )
            }
            // #endregion
            recordACPTransportFailure({
              operation: 'message',
              ...describeDiagnosticError(e)
            })
            finish('error', formatConnectionError(e, this.agentDef))
          })
      }
    })
  }

  async reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    return null
  }

  async destroy(): Promise<void> {
    this.destroying = true
    if (this.session) {
      await this.session.child.kill()
      this.session = null
    }
  }

  private async spawnAgent(): Promise<ACPSession> {
    // #region agent log
    {
      const { agentDebugLog } = await import('./debug-log')
      let hostEnv: {
        hasRedrobApiKey: boolean
        hasRedrobKeyAlias: boolean
        propagatedApiKeyFromAlias?: boolean
      } | null = null
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        hostEnv = await invoke('redrob_code_env_status')
      } catch (e) {
        hostEnv = null
        void agentDebugLog({
          hypothesisId: 'A',
          location: 'acp/transport.ts:spawnAgent',
          message: 'host env status invoke failed',
          data: { error: formatUnknownError(e) }
        })
      }
      void agentDebugLog({
        hypothesisId: 'A',
        location: 'acp/transport.ts:spawnAgent',
        message: 'spawning ACP agent',
        data: {
          agentId: this.agentDef.id,
          command: this.agentDef.command,
          args: this.agentDef.args,
          cwd: this.cwd,
          modelId: this.modelId,
          hostEnv
        }
      })
    }
    // #endregion
    let process: Awaited<ReturnType<typeof spawnACPProcess>>
    try {
      process = await spawnACPProcess({
        command: this.agentDef.command,
        args: this.agentDef.args,
        logId: this.agentDef.id,
        destroying: () => this.destroying,
        onUnexpectedClose: () => {
          if (!this.session) return
          this.session.dead = true
          this.session = null
        }
      })
    } catch (e) {
      recordACPTransportFailure({ operation: 'start', ...describeDiagnosticError(e) })
      throw new Error(formatConnectionError(e, this.agentDef))
    }
    const { child, input, output } = process
    const stream = ndJsonStream(input, output)
    let onUpdate: ACPSession['onUpdate'] = null

    const clientImpl: Client = {
      async requestPermission(
        params: RequestPermissionRequest
      ): Promise<RequestPermissionResponse> {
        const { requestPermissionFromUser } = await import('@/app/ai/acp/permission')
        return requestPermissionFromUser(params)
      },

      async sessionUpdate(params: SessionNotification): Promise<void> {
        onUpdate?.(params)
      }
    }

    const connection = new ClientSideConnection((_agent: Agent) => clientImpl, stream)
    const { getAutomationAuthToken } = await import('@/app/automation/mcp/spawn')
    // Design MCP automation is optional for ACP chat: a missing/unhealthy MCP
    // server must not kill the Redrob Code session before the model can reply.
    let automationAuthToken: string | null = null
    let includeBuiltInMCP = true
    try {
      automationAuthToken = await getAutomationAuthToken()
    } catch {
      includeBuiltInMCP = false
    }

    try {
      await connection.initialize({
        protocolVersion: PROTOCOL_VERSION,
        clientCapabilities: {}
      })
    } catch (e) {
      await child.kill().catch(() => undefined)
      throw startupError(e, this.agentDef)
    }

    let sessionResult
    try {
      sessionResult = await connection.newSession({
        cwd: this.cwd,
        mcpServers: await buildACPMCPServers({
          authorizationToken: automationAuthToken,
          includeBuiltIn: includeBuiltInMCP
        })
      })
    } catch (e) {
      await child.kill().catch(() => undefined)
      throw startupError(e, this.agentDef)
    }

    if (this.modelId) {
      try {
        await connection.setSessionConfigOption({
          sessionId: sessionResult.sessionId,
          configId: 'model',
          value: this.modelId
        })
      } catch (e) {
        // #region agent log
        {
          const { agentDebugLog } = await import('./debug-log')
          void agentDebugLog({
            hypothesisId: 'C',
            location: 'acp/transport.ts:setModel',
            message: 'ACP setSessionConfigOption(model) failed',
            data: {
              agentId: this.agentDef.id,
              modelId: this.modelId,
              error: formatUnknownError(e)
            }
          })
        }
        // #endregion
      }
    }

    // #region agent log
    {
      const { agentDebugLog } = await import('./debug-log')
      const configOptions = (
        sessionResult as { configOptions?: Array<{ id?: string; currentValue?: string }> }
      ).configOptions
      const modelOption = configOptions?.find((option) => option.id === 'model')
      void agentDebugLog({
        hypothesisId: 'C',
        location: 'acp/transport.ts:newSession',
        message: 'ACP session created',
        data: {
          agentId: this.agentDef.id,
          sessionId: sessionResult.sessionId,
          includeBuiltInMCP,
          requestedModelId: this.modelId || null,
          modelCurrentValue: modelOption?.currentValue ?? null,
          configOptionIds: configOptions?.map((option) => option.id) ?? []
        }
      })
    }
    // #endregion

    const session: ACPSession = {
      connection,
      sessionId: sessionResult.sessionId,
      child,
      dead: false,
      get onUpdate() {
        return onUpdate
      },
      set onUpdate(fn) {
        onUpdate = fn
      }
    }

    return session
  }
}

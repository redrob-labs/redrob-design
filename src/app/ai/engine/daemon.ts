/**
 * The user's shared Redrob Code daemon, from this app.
 *
 * Redrob Design runs on the engine and nothing else: the design-by-prompt loop over ACP
 * (`redrob acp --attach`), and the model profiles (design, review, fast, vision) over the daemon's
 * OpenAI-compatible route, `/v1/chat/completions`. Both reach the ONE daemon every Redrob app on
 * this machine shares. The engine holds the credentials, picks the provider, masks personal
 * details, and counts this app among its clients so it stays up while Design runs.
 *
 * Finding the daemon is `redrob service start --json` (docs/LOCAL-ENGINE-API.md in redrob-code):
 * it prints the record, starts the daemon first when none answers, and replaces one of another
 * version. The record's secret is the Basic password; it changes on every daemon start, so a
 * failing request re-reads the record instead of trusting a cached one.
 */
import { REDROB_CODE_SERVICE_COMMAND } from '@redrob-design/core/constants'

import { decodeTauriStderr } from '@/app/shell/ui'
import { resolvePlatformCommand } from '@/app/tauri/command'
import { isTauri } from '@/app/tauri/env'

export type EngineDaemon = {
  readonly id: string
  readonly version: string
  readonly url: string
  readonly port: number
  readonly pid: number
  readonly secret: string
}

export const ENGINE_APP_LABEL = 'design'

export class EngineUnavailableError extends Error {
  override readonly name = 'EngineUnavailableError'
  readonly code = 'engine_unavailable' as const
  constructor(reason: string) {
    super(
      `Redrob Design runs on the Redrob Code engine, and it could not be reached. ${reason} ` +
        'Install Redrob Code (the launcher does it in one click), or point REDROB_CODE_BIN at the binary.'
    )
  }
}

/** What `redrob service start --json` prints, before it is checked field by field. */
type DaemonRecordShape = Partial<Record<keyof EngineDaemon, unknown>>

function isDaemon(value: unknown): value is EngineDaemon {
  if (typeof value !== 'object' || value === null) return false
  const v: DaemonRecordShape = value
  return (
    typeof v.id === 'string' &&
    typeof v.version === 'string' &&
    typeof v.url === 'string' &&
    typeof v.port === 'number' &&
    typeof v.pid === 'number' &&
    typeof v.secret === 'string'
  )
}

export function engineHeaders(daemon: Pick<EngineDaemon, 'secret'>): Record<string, string> {
  return { Authorization: `Basic ${btoa(`redrob:${daemon.secret}`)}` }
}

/** Where the OpenAI-compatible face lives; the AI SDK appends `/chat/completions`. */
export function engineOpenAIBaseURL(daemon: Pick<EngineDaemon, 'url'>): string {
  return `${daemon.url.replace(/\/+$/, '')}/v1`
}

/** Pulls the one JSON line `redrob service start --json` prints out of whatever else was printed. */
export function parseDaemonRecord(stdout: string): EngineDaemon {
  const line = stdout
    .split('\n')
    .map((l) => l.trim())
    .findLast((l) => l.startsWith('{'))
  if (!line) throw new EngineUnavailableError('The engine printed no daemon record.')
  let value: unknown
  try {
    value = JSON.parse(line)
  } catch {
    throw new EngineUnavailableError('The engine printed a daemon record that is not JSON.')
  }
  if (!isDaemon(value))
    throw new EngineUnavailableError('The engine printed an incomplete daemon record.')
  return value
}

type Spawn = (
  command: string,
  args: string[]
) => Promise<{ code: number | null; stdout: string; stderr: string }>

async function tauriSpawn(command: string, args: string[]) {
  const { Command } = await import('@tauri-apps/plugin-shell')
  const resolved = resolvePlatformCommand(command, args)
  const output = await Command.create(resolved.command, resolved.args, {
    env: { REDROB_APP: ENGINE_APP_LABEL }
  }).execute()
  return { code: output.code, stdout: output.stdout, stderr: decodeTauriStderr(output.stderr) }
}

let cached: EngineDaemon | null = null
let pending: Promise<EngineDaemon> | null = null

/**
 * The daemon, found or started. Cached once it answered; `connectEngine({ fresh: true })` after a
 * 401 or a connection failure re-runs the lookup, which also restarts a daemon that died.
 */
export async function connectEngine(
  options: { fresh?: boolean; spawn?: Spawn } = {}
): Promise<EngineDaemon> {
  if (cached && !options.fresh) return cached
  if (pending && !options.fresh) return pending
  if (!options.spawn && !isTauri()) {
    throw new EngineUnavailableError(
      'The engine runs on this computer, so it is only reachable from the desktop app.'
    )
  }
  const spawn = options.spawn ?? tauriSpawn
  const command = REDROB_CODE_SERVICE_COMMAND
  pending = (async () => {
    let result: Awaited<ReturnType<Spawn>>
    try {
      result = await spawn(command.command, command.args)
    } catch (error) {
      throw new EngineUnavailableError(
        `"${command.command}" could not be run (${error instanceof Error ? error.message : String(error)}).`
      )
    }
    if (result.code !== 0) {
      throw new EngineUnavailableError(
        `"${command.command} ${command.args.join(' ')}" exited with ${result.code}: ${result.stderr.trim() || result.stdout.trim()}`
      )
    }
    const daemon = parseDaemonRecord(result.stdout)
    cached = daemon
    return daemon
  })()
  try {
    return await pending
  } finally {
    pending = null
  }
}

/** Test seam. */
export function resetEngineConnection(): void {
  cached = null
  pending = null
}

/** Temporary agent debug logger — writes NDJSON to the cloud debug log path. */

const DEBUG_LOG_PATH = '/opt/cursor/logs/debug.log'

export async function agentDebugLog(entry: {
  hypothesisId: string
  location: string
  message: string
  data?: Record<string, unknown>
}): Promise<void> {
  const line =
    JSON.stringify({
      id: `log_${Date.now()}`,
      timestamp: Date.now(),
      hypothesisId: entry.hypothesisId,
      location: entry.location,
      message: entry.message,
      data: entry.data ?? {},
      runId: 'post-fix'
    }) + '\n'

  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('agent_debug_log', { line })
    return
  } catch {
    // Fall through when not running under Tauri or the command is unavailable.
  }

  try {
    const { readTextFile, writeTextFile, mkdir } = await import('@tauri-apps/plugin-fs')
    await mkdir('/opt/cursor/logs', { recursive: true }).catch(() => undefined)
    let prev = ''
    try {
      prev = await readTextFile(DEBUG_LOG_PATH)
    } catch {
      prev = ''
    }
    await writeTextFile(DEBUG_LOG_PATH, prev + line)
    return
  } catch {
    // Fall through to Node for unit tests / non-Tauri probes.
  }

  try {
    const { appendFileSync, mkdirSync } = await import('node:fs')
    mkdirSync('/opt/cursor/logs', { recursive: true })
    appendFileSync(DEBUG_LOG_PATH, line)
  } catch {
    // Swallow — debug logging must never break ACP.
  }
}

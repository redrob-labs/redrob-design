import { useIntervalFn } from '@vueuse/core'

import { REDROB_CONSOLE_API_BASE } from '@redrob-design/core/constants'

import { appWorkModelDeps } from '@/app/ai/insights/desktop'
import { createWorkModel } from '@/app/ai/insights/model'
import { createIDBInsightsOutbox } from '@/app/ai/insights/outbox'
import { createChatInsights } from '@/app/ai/insights/sessions'
import { createInsightsSync, SYNC_INTERVAL_MS, type ConsoleTarget } from '@/app/ai/insights/sync'
import {
  aiModelSettings,
  designModelConnection,
  resolveModelConnectionAPIKey
} from '@/app/ai/models'
import { onDocumentExported } from '@/app/document/export/events'
import { getActiveEditorStoreOrNull, type EditorStore } from '@/app/editor/active-store'
import { isTauri } from '@/app/tauri/env'
import { tauriFetch } from '@/app/tauri/http'

export { toDesignSession, DESIGN_LABELING_APP, DESIGN_MAX_MODE } from '@/app/ai/insights/app'
export type { WorkModelState } from '@/app/ai/insights/model'

const SWEEP_INTERVAL_MS = 60_000

/**
 * The Redrob connection whose key reports sessions: the Design role's when it is Redrob, else the
 * first Redrob connection. Its own base URL wins, so a self-hosted key never goes to another Console.
 */
async function resolveConsoleTarget(): Promise<ConsoleTarget | null> {
  const design = designModelConnection.value
  const connection =
    design?.providerID === 'redrob'
      ? design
      : aiModelSettings.value.connections.find((candidate) => candidate.providerID === 'redrob')
  if (!connection) return null
  const key = await resolveModelConnectionAPIKey(connection.id)
  if (!key) return null
  return { key, baseUrl: connection.customBaseURL.trim() || REDROB_CONSOLE_API_BASE }
}

export const workModel = createWorkModel(appWorkModelDeps())

const outbox = createIDBInsightsOutbox()

const insightsSync = createInsightsSync({
  outbox,
  resolveTarget: resolveConsoleTarget,
  fetch: (input, init) => (isTauri() ? tauriFetch(input, init) : globalThis.fetch(input, init))
})

let timersStarted = false

function startTimers(): void {
  if (timersStarted) return
  timersStarted = true
  useIntervalFn(() => void chatInsights.sweep(), SWEEP_INTERVAL_MS)
  useIntervalFn(() => void insightsSync.run(), SYNC_INTERVAL_MS)
}

/** AI work insights for Design's chats, one session per editor tab. */
export const chatInsights = createChatInsights<EditorStore>({
  queue: (session) => outbox.add(session),
  classifier: () => workModel.classifier(),
  onRedrobChatFinished: () => {
    startTimers()
    void workModel.request()
  }
})

// Exporting from a tab with a session running sends its work outward.
onDocumentExported((state) => {
  const store = getActiveEditorStoreOrNull()
  if (store?.state === state) chatInsights.exported(store)
})

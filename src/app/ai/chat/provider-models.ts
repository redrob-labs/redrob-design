import { AI_PROVIDERS, ENGINE_AUTO_MODEL } from '@redrob-design/core/constants'
import type { AIProviderID, ModelOption } from '@redrob-design/core/constants'

import { connectEngine, engineHeaders } from '@/app/ai/engine/daemon'

/**
 * The models the engine can reach, as its `GET /api/model` lists them: `provider/model` ids, tool
 * and image capabilities straight from the engine's catalogue. The curated list (Redrob Auto) is
 * what is shown when the engine cannot be asked, so the picker is never empty.
 */
type EngineModel = {
  id?: unknown
  providerID?: unknown
  name?: unknown
  enabled?: unknown
  capabilities?: { tools?: unknown; input?: unknown }
  request?: { maxOutputTokens?: unknown }
}

function curatedProviderModels(providerID: AIProviderID) {
  return AI_PROVIDERS.find((provider) => provider.id === providerID)?.models ?? []
}

function engineModelName(id: string, model: EngineModel): string {
  if (id === ENGINE_AUTO_MODEL) return 'Redrob Auto'
  if (typeof model.name === 'string' && model.name)
    return `${model.name} (${String(model.providerID)})`
  return id
}

export function normalizeEngineModel(model: EngineModel): ModelOption | null {
  if (typeof model.id !== 'string' || !model.id || typeof model.providerID !== 'string') return null
  if (model.enabled === false) return null
  const input = model.capabilities?.input
  const id = `${model.providerID}/${model.id}`
  return {
    id,
    name: engineModelName(id, model),
    capabilities: [
      ...(model.capabilities?.tools === true ? (['tools'] as const) : []),
      ...(Array.isArray(input) && input.includes('image') ? (['vision'] as const) : [])
    ]
  }
}

let modelsPromise: Promise<ModelOption[]> | null = null

async function fetchEngineModels(fetcher: typeof fetch): Promise<ModelOption[]> {
  const daemon = await connectEngine()
  const response = await fetcher(`${daemon.url.replace(/\/+$/, '')}/api/model`, {
    headers: engineHeaders(daemon)
  })
  if (!response.ok) throw new Error(`Engine model list failed: ${response.status}`)
  const json = (await response.json()) as { data?: EngineModel[] }
  const models = json.data?.map(normalizeEngineModel).filter((model) => model !== null) ?? []
  // Redrob Auto first, the rest in the engine's order (newest release first).
  return [
    ...models.filter((m) => m.id === ENGINE_AUTO_MODEL),
    ...models.filter((m) => m.id !== ENGINE_AUTO_MODEL)
  ]
}

async function listEngineModels(fetcher: typeof fetch): Promise<ModelOption[]> {
  modelsPromise ??= fetchEngineModels(fetcher).then(
    (models) => (models.length ? models : curatedProviderModels('engine')),
    () => curatedProviderModels('engine')
  )
  return modelsPromise
}

/** Forget the fetched list, so the next picker opening asks the engine again. */
export function resetEngineModelList(): void {
  modelsPromise = null
}

export async function listProviderModels(
  providerID: AIProviderID,
  fetcher: typeof fetch = fetch
): Promise<ModelOption[]> {
  if (providerID === 'engine') return listEngineModels(fetcher)
  return curatedProviderModels(providerID)
}

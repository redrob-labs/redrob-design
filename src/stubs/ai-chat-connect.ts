/**
 * UI-slice stubs for the ProfileEditor's chat/connect backend seams.
 *
 * ProfileEditor (ported as a presentational skeleton) still references a handful
 * of engine functions: provider-status refresh, the models.dev catalogue lookup,
 * the connection test, and the Redrob device-connect flow. None of those exist
 * in a presentation slice, so each is a documented no-op here that returns the
 * neutral/empty result. The form renders and behaves; nothing calls out.
 *
 * One stub module backs several alias targets (see vite.config.ts / tsconfig):
 *   @/app/ai/chat/storage          -> refreshAIProviderStatus
 *   @/app/ai/models/catalog        -> resolveModelsDevModel
 *   @/app/ai/chat/connection-test  -> testProviderConnection (+ type)
 *   @/app/ai/connect/app-connect   -> beginRedrobConnect, awaitRedrobConnect
 *   @/app/ai/connect/device-connect-> DeviceAuthorization (type)
 */

/* ---- @/app/ai/chat/storage ---- */
export function refreshAIProviderStatus(): Promise<void> {
  return Promise.resolve()
}

/* ---- @/app/ai/models/catalog ---- */
export interface CatalogModel {
  id: string
  name: string
  capabilities: Array<'tools' | 'vision'>
  recommendedMaxOutputTokens?: number
}

/** The real resolver reads the models.dev catalogue; the stub finds nothing. */
export function resolveModelsDevModel(
  _providerID: string,
  _modelID: string
): Promise<CatalogModel | null> {
  return Promise.resolve(null)
}

/* ---- @/app/ai/chat/connection-test ---- */
export type ProviderConnectionTestFailureReason = string

export interface ConnectionTestResult {
  ok: boolean
  reason?: ProviderConnectionTestFailureReason
}

/** No network in the slice: report success so the form's happy path renders. */
export function testProviderConnection(_input: {
  providerID: string
  apiKey: string
  modelID: string
  customModelID: string
  customBaseURL: string
  customAPIType: string
}): Promise<ConnectionTestResult> {
  return Promise.resolve({ ok: true })
}

/* ---- @/app/ai/connect/device-connect ---- */
export interface DeviceAuthorization {
  userCode: string
  verificationUri: string
}

/* ---- @/app/ai/connect/app-connect ---- */
export function beginRedrobConnect(): Promise<DeviceAuthorization> {
  return Promise.resolve({ userCode: 'XXXX-XXXX', verificationUri: 'https://redrob.example' })
}

export type RedrobConnectOutcome =
  | { status: 'connected'; key: { apiKey: string; apiBaseURL?: string } }
  | { status: 'cancelled' }
  | { status: 'unreachable' }

/** The stub immediately reports cancelled, so no key is ever minted. */
export function awaitRedrobConnect(
  _authorization: DeviceAuthorization,
  _cancelled: () => boolean
): Promise<RedrobConnectOutcome> {
  return Promise.resolve({ status: 'cancelled' })
}

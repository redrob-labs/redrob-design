import { useLocalStorage } from '@vueuse/core'
import { computed, reactive } from 'vue'

import { encodeBase64 } from '@redrob-design/core/bytes'

import {
  runDeviceConnect,
  startDeviceAuthorization,
  type DeviceAuthorization,
  type DeviceConnectDeps
} from '@/app/ai/connect/device-connect'
import { appCredentialServices } from '@/app/settings/credentials/app'
import { credentialRef } from '@/app/settings/credentials/reference'
import { isTauri } from '@/app/tauri/env'
import {
  RedrobAuthError,
  RedrobAuthUnavailableError,
  cancelRedrobAuthSignIn,
  hasRedrobAuthSession,
  redrobAuthAccessToken,
  redrobAuthAvailable,
  signInWithRedrobAuth,
  signOutOfRedrobAuth
} from '@/app/integrations/redrob-auth/login'
import { openExternalLink } from '@/app/shell/ui'

import { consoleCache } from './cache'
import { ConsoleError, createConsoleClient, type ConsoleClient, type ConsoleFetch } from './client'
import { meSchema, type ConsoleAccount } from './contract/schemas'

/** The Console session token: a credential like any other, never in a reactive ref. */
export const CONSOLE_SESSION_REF = credentialRef('console', 'session-token')
/** The device-flow product Console issues Redrob Design Cloud sessions for. */
export const CLOUD_DEVICE_PRODUCT = 'design-cloud' as const

export type CloudStatus = 'signed-out' | 'signing-in' | 'signed-in' | 'unreachable' | 'unavailable'

export interface CloudSignIn {
  userCode: string
  verificationURI: string
  verificationURIComplete: string
}

/** Non-secret state the UI shows: who is signed in and which workspace is in use. */
export const cloudState = reactive<{
  status: CloudStatus
  account: ConsoleAccount | null
  signIn: CloudSignIn | null
  error: string | null
}>({ status: 'signed-out', account: null, signIn: null, error: null })

const selectedWorkspace = useLocalStorage<string | null>('redrob-design:cloud:workspace', null, {
  writeDefaults: false
})

/**
 * Which installation this is, to Console. Not a secret: it only keeps this computer's key apart from
 * the same person's other computers, so it lives in ordinary storage and survives signing out.
 */
const installation = useLocalStorage<string | null>('redrob-design:cloud:install', null, {
  writeDefaults: false
})

const INSTALL_ID_BYTES = 24

export function cloudInstallId(): string {
  if (installation.value && /^[A-Za-z0-9_-]{16,64}$/.test(installation.value)) {
    return installation.value
  }
  const id = encodeBase64(crypto.getRandomValues(new Uint8Array(INSTALL_ID_BYTES)), 'base64url')
  installation.value = id
  return id
}

/** The workspace features read from: the one picked, else the one this installation was approved into. */
export const activeWorkspaceId = computed<string | null>(() => {
  const account = cloudState.account
  const workspaces = account?.workspaces ?? []
  const picked = workspaces.find((workspace) => workspace.id === selectedWorkspace.value)
  const current = workspaces.find((workspace) => workspace.id === account?.currentWorkspaceId)
  return picked?.id ?? current?.id ?? workspaces.at(0)?.id ?? null
})

export function selectWorkspace(id: string): void {
  selectedWorkspace.value = id
}

export const signedIn = computed(() => cloudState.status === 'signed-in')

/**
 * Signed in, but the chat API has no design backend (404 on `/design/me`): sharing, comments,
 * versions and live collaboration are shown as unavailable rather than as errors.
 */
export const cloudUnavailable = computed(() => cloudState.status === 'unavailable')

/**
 * The bearer for Console and the design backend: the redrob-auth access token when this
 * computer signed in through redrob-auth, else the Console session token (the older device
 * sign-in, kept as the fallback). Console accepts both.
 */
async function sessionToken(): Promise<string | null> {
  if (await hasRedrobAuthSession()) {
    try {
      const token = await redrobAuthAccessToken()
      if (token) return token
    } catch (error) {
      throw new ConsoleError(
        'unreachable',
        error instanceof Error ? error.message : 'Redrob sign-in could not be reached'
      )
    }
  }
  return appCredentialServices.resolver.resolve(CONSOLE_SESSION_REF)
}

async function hasSession(): Promise<boolean> {
  if (await hasRedrobAuthSession()) return true
  return (await appCredentialServices.manager.status(CONSOLE_SESSION_REF)) === 'configured'
}

/** The fetch the app reaches Console and its presigned storage links with. */
export function appFetch(): ConsoleFetch {
  if (!isTauri()) return (url, init) => fetch(url, init)
  return async (url, init) => {
    const { tauriFetch } = await import('@/app/tauri/http')
    return tauriFetch(url, init)
  }
}

export function appCloudDeps(): DeviceConnectDeps {
  return {
    fetch: appFetch(),
    now: () => Date.now(),
    sleep: (ms) =>
      new Promise((resolve) => {
        setTimeout(resolve, ms)
      })
  }
}

let client: ConsoleClient | null = null

/** The Console client every Cloud feature shares; the token is read per request. */
export function consoleClient(): ConsoleClient {
  client ??= createConsoleClient({
    token: sessionToken,
    fetch: appFetch()
  })
  return client
}

export function setConsoleClientForTests(next: ConsoleClient | null): void {
  client = next
}

const ACCOUNT_CACHE_KEY = 'me'

function isAccount(value: unknown): value is ConsoleAccount {
  return meSchema.safeParse(value).success
}

/**
 * Reads who is signed in. Offline, the last known account is kept so local
 * features stay as they were; a rejected token signs out.
 */
export async function refreshCloudAccount(): Promise<void> {
  if (!(await hasSession())) {
    cloudState.status = 'signed-out'
    cloudState.account = null
    return
  }
  try {
    const { data } = await consoleClient().call('getMe')
    cloudState.account = data
    cloudState.status = 'signed-in'
    cloudState.error = null
    await consoleCache().put(ACCOUNT_CACHE_KEY, data, null)
  } catch (error) {
    if (error instanceof ConsoleError && error.kind === 'not-signed-in') {
      await signOutOfCloud()
      return
    }
    if (error instanceof ConsoleError && error.kind === 'not-found') {
      cloudState.account = null
      cloudState.status = 'unavailable'
      cloudState.error = null
      return
    }
    const cached = await consoleCache().get(ACCOUNT_CACHE_KEY, isAccount)
    cloudState.account = cached?.value ?? null
    cloudState.status = cached ? 'signed-in' : 'unreachable'
    cloudState.error = error instanceof Error ? error.message : String(error)
  }
}

let cancelSignIn: (() => void) | null = null

const CONSOLE_CONNECT_URL = 'https://console.redrob.ai/connect'

/** Only https addresses are opened from a sign-in answer. */
function httpsOr(url: string): string {
  try {
    return new URL(url).protocol === 'https:' ? url : CONSOLE_CONNECT_URL
  } catch {
    return CONSOLE_CONNECT_URL
  }
}

/**
 * Signs in. With redrob-auth available (the desktop app, issuer configured) the system browser
 * opens redrob-auth and the refresh token goes to the OS keychain. When redrob-auth cannot be used
 * (browser build, client not registered, grant off) the Console device flow runs instead: the
 * person approves a short code in Console, and the session token goes to the credential store.
 */
export async function signInToCloud(
  deps: DeviceConnectDeps = appCloudDeps()
): Promise<CloudStatus> {
  cancelSignIn?.()
  let cancelled = false
  cancelSignIn = () => {
    cancelled = true
    cancelRedrobAuthSignIn()
  }
  const isCancelled = (): boolean => cancelled
  cloudState.status = 'signing-in'
  cloudState.error = null
  if (redrobAuthAvailable()) {
    try {
      await signInWithRedrobAuth(openExternalLink)
      await refreshCloudAccount()
      return cloudState.status
    } catch (error) {
      if (!(error instanceof RedrobAuthUnavailableError)) {
        cloudState.signIn = null
        if (isCancelled() || (error instanceof RedrobAuthError && error.code === 'cancelled')) {
          cloudState.status = 'signed-out'
          cloudState.error = null
        } else if (error instanceof RedrobAuthError && error.code === 'unreachable') {
          cloudState.status = 'unreachable'
          cloudState.error = error.message
        } else {
          cloudState.status = 'signed-out'
          cloudState.error =
            error instanceof RedrobAuthError && error.code === 'access_denied'
              ? 'denied'
              : error instanceof RedrobAuthError && error.code === 'timeout'
                ? 'expired'
                : error instanceof Error
                  ? error.message
                  : String(error)
        }
        return cloudState.status
      }
      // redrob-auth is not set up for this app: fall through to the Console device sign-in.
    }
    if (isCancelled()) {
      cloudState.status = 'signed-out'
      return cloudState.status
    }
  }
  let authorization: DeviceAuthorization
  try {
    authorization = await startDeviceAuthorization(CLOUD_DEVICE_PRODUCT, deps, cloudInstallId())
  } catch (error) {
    cloudState.status = 'unreachable'
    cloudState.error = error instanceof Error ? error.message : String(error)
    return cloudState.status
  }
  cloudState.signIn = {
    userCode: authorization.userCode,
    verificationURI: httpsOr(authorization.verificationURI),
    verificationURIComplete: httpsOr(authorization.verificationURIComplete)
  }
  const outcome = await runDeviceConnect({ authorization, deps, isCancelled })
  cloudState.signIn = null
  if (outcome.status !== 'connected') {
    cloudState.status = outcome.status === 'unreachable' ? 'unreachable' : 'signed-out'
    cloudState.error = outcome.status === 'cancelled' ? null : outcome.status
    return cloudState.status
  }
  await appCredentialServices.manager.set(CONSOLE_SESSION_REF, outcome.key.apiKey)
  await refreshCloudAccount()
  return cloudState.status
}

export function cancelCloudSignIn(): void {
  cancelSignIn?.()
  cancelSignIn = null
}

/** Forgets both sessions and everything cached from Console. */
export async function signOutOfCloud(): Promise<void> {
  cancelCloudSignIn()
  await signOutOfRedrobAuth()
  await appCredentialServices.manager.clear(CONSOLE_SESSION_REF)
  await consoleCache().clear()
  cloudState.status = 'signed-out'
  cloudState.account = null
  cloudState.signIn = null
}

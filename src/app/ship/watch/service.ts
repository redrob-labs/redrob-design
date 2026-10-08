import { useIntervalFn, type Pausable } from '@vueuse/core'
import type { UIMessage } from 'ai'
import { shallowReactive, watch } from 'vue'
import { z } from 'zod'

import { threadKeyFor, type ThreadIdentity } from '@/app/assistant/thread/store'
import { getActiveEditorStoreOrNull } from '@/app/editor/active-store'
import {
  ConsoleError,
  consoleCache,
  consoleClient,
  consoleDocumentId,
  signedIn,
  watchEventSchema,
  type WatchEvent
} from '@/app/integrations/console'
import { DEMO_WORKSPACE } from '@/app/memory/demo'
import { connectedWorkspace } from '@/app/memory/workspace'
import { demoMode } from '@/app/runtime/demo'

import { applyWatchEvent, type WatchTarget, type WatchWords } from './apply'

/** How often an open app asks Console what moved in the watched sources. */
export const WATCH_POLL_MS = 60_000

/** Changes kept for files that are not open; the oldest go first. */
const MAX_PENDING = 200

const REGISTRY_KEY = 'watches'
const CURSOR_KEY = 'watch-cursor'
const PENDING_KEY = 'watch-pending'

const registrationSchema = z.object({
  watchId: z.string().min(1),
  /** The app's own key for the document; it stays on this computer. */
  documentKey: z.string().min(1),
  pageId: z.string().min(1),
  sourceIds: z.array(z.string().min(1))
})
export type WatchRegistration = z.infer<typeof registrationSchema>

const registrationsSchema = z.array(registrationSchema)
const pendingSchema = z.array(watchEventSchema)

function isRegistrations(value: unknown): value is WatchRegistration[] {
  return registrationsSchema.safeParse(value).success
}

function isPending(value: unknown): value is WatchEvent[] {
  return pendingSchema.safeParse(value).success
}

function isCursor(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

/** The pages this computer watches through Console, by document key and page. */
export const watchRegistrations = shallowReactive(new Map<string, WatchRegistration>())
let pending: WatchEvent[] = []
let loaded: Promise<void> | null = null

function registrationKey(documentKey: string, pageId: string): string {
  return `${documentKey}\u0000${pageId}`
}

function loadState(): Promise<void> {
  loaded ??= (async () => {
    const cache = consoleCache()
    const [registrations, queued] = await Promise.all([
      cache.get(REGISTRY_KEY, isRegistrations),
      cache.get(PENDING_KEY, isPending)
    ])
    for (const registration of registrations?.value ?? []) {
      watchRegistrations.set(
        registrationKey(registration.documentKey, registration.pageId),
        registration
      )
    }
    pending = queued?.value ?? []
  })()
  return loaded
}

function saveRegistrations(): Promise<void> {
  return consoleCache().put(REGISTRY_KEY, [...watchRegistrations.values()], null)
}

function savePending(): Promise<void> {
  return consoleCache().put(PENDING_KEY, pending, null)
}

/** The sources a shipped page watches, or null when no workspace is connected. */
export function watchedSources(): string[] | null {
  if (demoMode.value) return [DEMO_WORKSPACE.sources[2], DEMO_WORKSPACE.sources[0]]
  const sources = connectedWorkspace.value?.sources ?? []
  return sources.length > 0 ? sources.map((source) => source.name) : null
}

/** The name a source goes by in the workspace, for the thread message. */
export function sourceName(sourceId: string): string {
  const source = connectedWorkspace.value?.sources.find((candidate) => candidate.id === sourceId)
  return source?.name ?? sourceId
}

/** True when this computer watches the page's sources through Console. */
export function isWatching(documentKey: string, pageId: string): boolean {
  return watchRegistrations.has(registrationKey(documentKey, pageId))
}

/**
 * Asks Console to watch the workspace's sources for a shipped page. Does
 * nothing on /demo, signed out, without sources, or when it already watches.
 */
export async function startWatching(documentKey: string, pageId: string): Promise<boolean> {
  const sources = connectedWorkspace.value?.sources ?? []
  if (demoMode.value || !signedIn.value || sources.length === 0) return false
  await loadState()
  if (isWatching(documentKey, pageId)) return true
  const sourceIds = sources.map((source) => source.id)
  const { data } = await consoleClient().call('createWatch', {
    body: { documentId: await consoleDocumentId(documentKey), pageId, sourceIds }
  })
  watchRegistrations.set(registrationKey(documentKey, pageId), {
    watchId: data.id,
    documentKey,
    pageId,
    sourceIds
  })
  await saveRegistrations()
  return true
}

/** Stops watching; a watch Console no longer has is forgotten all the same. */
export async function stopWatching(documentKey: string, pageId: string): Promise<void> {
  await loadState()
  const key = registrationKey(documentKey, pageId)
  const registration = watchRegistrations.get(key)
  if (!registration) return
  try {
    await consoleClient().call('deleteWatch', { params: { watchId: registration.watchId } })
  } catch (error) {
    if (!(error instanceof ConsoleError && error.kind === 'not-found')) throw error
  }
  watchRegistrations.delete(key)
  pending = pending.filter((event) => event.watchId !== registration.watchId)
  await Promise.all([saveRegistrations(), savePending()])
}

/** Where updates go: the open thread, with words in the person's language. */
export interface WatchDelivery {
  /** False while the thread is still loading. */
  ready(): boolean
  words(source: string, summary: string): WatchWords
  post(message: UIMessage): void
}

let delivery: WatchDelivery | null = null

function registrationFor(watchId: string): WatchRegistration | undefined {
  for (const registration of watchRegistrations.values()) {
    if (registration.watchId === watchId) return registration
  }
  return undefined
}

/**
 * Applies the changes waiting for the open page and posts each to its
 * thread. Changes for a file or page that is not open wait until it is.
 */
export function deliverWatchUpdates(
  target: (WatchTarget & ThreadIdentity) | null = getActiveEditorStoreOrNull()
): number {
  const into = delivery
  if (!into?.ready() || !target || pending.length === 0) return 0
  const documentKey = threadKeyFor(target)
  const pageId = target.state.currentPageId
  const ready = pending.filter((event) => {
    const registration = registrationFor(event.watchId)
    return registration?.documentKey === documentKey && registration.pageId === pageId
  })
  if (ready.length === 0) return 0
  pending = pending.filter((event) => !ready.includes(event))
  for (const event of ready) {
    const words = into.words(sourceName(event.sourceId), event.summary)
    into.post(applyWatchEvent(target, event, words))
  }
  void savePending()
  return ready.length
}

/** The thread takes updates while it is open; returns a stop function. */
export function registerWatchDelivery(next: WatchDelivery): () => void {
  delivery = next
  void loadState().then(() => deliverWatchUpdates())
  return () => {
    if (delivery === next) delivery = null
  }
}

/**
 * Asks Console what moved since the last call and queues the changes for
 * watched pages. The first call only takes a cursor, so nothing from before
 * the page was watched lands on it.
 */
export async function pollWatchEvents(): Promise<number> {
  await loadState()
  if (!signedIn.value || watchRegistrations.size === 0) return 0
  const cache = consoleCache()
  const cursor = await cache.get(CURSOR_KEY, isCursor)
  const { data } = await consoleClient().call('listWatchEvents', {
    query: cursor ? { since: cursor.value } : {}
  })
  const known = new Set(pending.map((event) => event.id))
  const fresh = data.items.filter(
    (event) => registrationFor(event.watchId) !== undefined && !known.has(event.id)
  )
  pending = [...pending, ...fresh].slice(-MAX_PENDING)
  if (fresh.length > 0) await savePending()
  if (data.nextCursor) await cache.put(CURSOR_KEY, data.nextCursor, null)
  deliverWatchUpdates()
  return fresh.length
}

let polling: Pausable | null = null

function pollQuietly(): void {
  pollWatchEvents().catch((error: unknown) => {
    if (error instanceof ConsoleError && error.kind === 'not-signed-in') polling?.pause()
    else console.warn('[Watch] Could not read watched changes', error)
  })
}

/** Polls Console while the app is open and signed in. */
export function startWatchPolling(): void {
  if (polling) return
  const interval = useIntervalFn(pollQuietly, WATCH_POLL_MS, {
    immediate: false,
    immediateCallback: true
  })
  polling = interval
  watch(
    signedIn,
    (isSignedIn) => {
      if (isSignedIn) interval.resume()
      else interval.pause()
    },
    { immediate: true }
  )
}

/** Forgets what is loaded in memory, for tests. */
export function resetWatchesForTests(): void {
  polling?.pause()
  watchRegistrations.clear()
  pending = []
  loaded = null
  delivery = null
}

/** The demo's price sheet change: Team moves from $24 to $28. */
const DEMO_PRICE_EVENT = {
  id: 'demo-price-sheet',
  change: { kind: 'price', plan: 'Team', from: '$24', to: '$28' }
} as const

let demoCount = 0

/**
 * Demo only. The watched price sheet changes, so the page proposes its own
 * update through the same path Console's changes take. Null outside demo mode.
 */
export function simulatePriceSheetChange(target: WatchTarget, words: WatchWords): UIMessage | null {
  if (!demoMode.value) return null
  return applyWatchEvent(target, { ...DEMO_PRICE_EVENT, id: `demo-${++demoCount}` }, words)
}

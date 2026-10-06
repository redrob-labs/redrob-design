import type { z } from 'zod'

import { REDROB_CONSOLE_API_BASE } from '@redrob-design/core/constants'

import {
  consoleRoute,
  routePath,
  type CONSOLE_ROUTES,
  type ConsoleOperationId,
  type ConsoleRoute
} from './contract/routes'
import { errorBodySchema } from './contract/schemas'

/** What went wrong, in the terms the UI acts on. */
export type ConsoleErrorKind =
  | 'not-signed-in'
  | 'unreachable'
  | 'forbidden'
  | 'not-found'
  | 'conflict'
  | 'invalid'
  | 'rate-limited'

export class ConsoleError extends Error {
  constructor(
    readonly kind: ConsoleErrorKind,
    message: string,
    readonly status: number | null = null,
    readonly code: string | null = null,
    /** Seconds Console asked to wait, from Retry-After. */
    readonly retryAfter: number | null = null
  ) {
    super(message)
    this.name = 'ConsoleError'
  }
}

export type ConsoleFetch = (input: string, init: RequestInit) => Promise<Response>

export interface ConsoleClientOptions {
  baseURL?: string
  /** Resolved for every request and never kept; null when signed out. */
  token: () => Promise<string | null>
  fetch: ConsoleFetch
  timeoutMs?: number
  maxResponseBytes?: number
}

export interface ConsoleRequest {
  params?: Record<string, string>
  query?: Record<string, string | undefined>
  body?: unknown
  ifMatch?: string
  ifNoneMatch?: '*'
  signal?: AbortSignal
}

export interface ConsoleResponse<T> {
  data: T
  etag: string | null
}

export const CONSOLE_TIMEOUT_MS = 20_000
/** Larger answers are refused; version snapshots are the biggest thing Console sends. */
export const CONSOLE_MAX_RESPONSE_BYTES = 64 * 1024 * 1024

function retryAfterSeconds(response: Response): number | null {
  const header = response.headers.get('retry-after')
  if (!header) return null
  const seconds = Number(header)
  if (Number.isFinite(seconds) && seconds >= 0) return seconds
  const date = Date.parse(header)
  return Number.isNaN(date) ? null : Math.max(0, Math.round((date - Date.now()) / 1000))
}

function kindForStatus(status: number): ConsoleErrorKind {
  if (status === 401) return 'not-signed-in'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not-found'
  if (status === 409 || status === 412) return 'conflict'
  if (status === 429) return 'rate-limited'
  if (status >= 500) return 'unreachable'
  return 'invalid'
}

async function readBody(response: Response, limit: number): Promise<string> {
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > limit) {
    throw new ConsoleError(
      'invalid',
      'Console sent more than Redrob Design accepts',
      response.status
    )
  }
  const text = await response.text()
  if (text.length > limit) {
    throw new ConsoleError(
      'invalid',
      'Console sent more than Redrob Design accepts',
      response.status
    )
  }
  return text
}

function parseJSON(text: string, status: number): unknown {
  try {
    return JSON.parse(text)
  } catch {
    throw new ConsoleError('invalid', 'Console sent a response that is not JSON', status)
  }
}

type RouteOf<Op extends ConsoleOperationId> = Extract<
  (typeof CONSOLE_ROUTES)[number],
  { operationId: Op }
>

/** What an operation answers with, from its response schema; null for 204s. */
export type ConsoleData<Op extends ConsoleOperationId> = RouteOf<Op>['response'] extends z.ZodType
  ? z.infer<RouteOf<Op>['response']>
  : null

/** The schema of this operation already checked the value. */
function checked<Op extends ConsoleOperationId>(value: unknown): ConsoleData<Op> {
  return value as ConsoleData<Op>
}

function emptyData<Op extends ConsoleOperationId>(): ConsoleData<Op> {
  return null as ConsoleData<Op>
}

/**
 * One typed boundary to Redrob Console. Every response is checked against
 * the contract schemas; nothing Console sends reaches the app unchecked.
 */
export function createConsoleClient(options: ConsoleClientOptions) {
  const base = (options.baseURL ?? REDROB_CONSOLE_API_BASE).replace(/\/+$/, '')
  const timeoutMs = options.timeoutMs ?? CONSOLE_TIMEOUT_MS
  const limit = options.maxResponseBytes ?? CONSOLE_MAX_RESPONSE_BYTES

  function urlFor(route: ConsoleRoute, request: ConsoleRequest): string {
    const url = new URL(`${base}${routePath(route, request.params)}`)
    for (const [key, value] of Object.entries(request.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, value)
    }
    return url.href
  }

  async function headersFor(
    route: ConsoleRoute,
    request: ConsoleRequest
  ): Promise<Record<string, string>> {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (route.auth === 'bearer') {
      const token = await options.token()
      if (!token) throw new ConsoleError('not-signed-in', 'Sign in to Redrob Cloud first')
      headers.Authorization = `Bearer ${token}`
    }
    if (request.body !== undefined) headers['Content-Type'] = 'application/json'
    if (request.ifMatch) headers['If-Match'] = request.ifMatch
    if (request.ifNoneMatch) headers['If-None-Match'] = request.ifNoneMatch
    return headers
  }

  async function send(route: ConsoleRoute, request: ConsoleRequest): Promise<Response> {
    const headers = await headersFor(route, request)
    const timeout = AbortSignal.timeout(timeoutMs)
    try {
      return await options.fetch(urlFor(route, request), {
        method: route.method,
        headers,
        body: request.body === undefined ? undefined : JSON.stringify(request.body),
        credentials: 'omit',
        signal: request.signal ? AbortSignal.any([request.signal, timeout]) : timeout
      })
    } catch (error) {
      if (request.signal?.aborted) throw error
      throw new ConsoleError(
        'unreachable',
        timeout.aborted ? 'Console did not answer in time' : 'Console could not be reached'
      )
    }
  }

  async function failureOf(response: Response): Promise<ConsoleError> {
    const text = await readBody(response, limit).catch(() => '')
    const parsed = errorBodySchema.safeParse(text ? parseJSON(text, response.status) : null)
    const code = parsed.success ? parsed.data.error : null
    return new ConsoleError(
      kindForStatus(response.status),
      code ?? `Console answered ${response.status}`,
      response.status,
      code,
      retryAfterSeconds(response)
    )
  }

  async function call<Op extends ConsoleOperationId>(
    operationId: Op,
    request: ConsoleRequest = {}
  ): Promise<ConsoleResponse<ConsoleData<Op>>> {
    const route = consoleRoute(operationId)
    const schema: z.ZodType | null = route.response
    const response = await send(route, request)
    const etag = response.headers.get('etag')
    if (!response.ok) throw await failureOf(response)
    if (schema === null || response.status === 204) {
      return { data: emptyData<Op>(), etag }
    }
    const value = parseJSON(await readBody(response, limit), response.status)
    const parsed = schema.safeParse(value)
    if (!parsed.success) {
      throw new ConsoleError(
        'invalid',
        `Console sent an unexpected ${operationId} response`,
        response.status
      )
    }
    return { data: checked<Op>(parsed.data), etag }
  }

  return { call, baseURL: base }
}

export type ConsoleClient = ReturnType<typeof createConsoleClient>

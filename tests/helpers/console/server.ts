import { Hono, type Context } from 'hono'
import type { z } from 'zod'

import {
  createWatchSchema,
  registerDeviceSchema,
  type ConsoleAccount,
  type ConsoleWatch,
  type ConsoleWorkspace,
  type ConsoleWorkspaceMemory,
  type LeaderboardFeed,
  type ModelRatesFeed,
  type WatchEvent
} from '@/app/integrations/console/contract/schemas'

import {
  BLOB_ORIGIN,
  answerBlob,
  mockDesignState,
  registerDesignFiles,
  type MockDesignState
} from './design'

/**
 * A Redrob Console that lives in memory: every endpoint in the contract,
 * with the same conventions, fed by fixtures. It is the acceptance oracle
 * handed to the Console team: what this server does, Console must do.
 */

export const MOCK_TOKEN = 'console-session-token-for-tests'
export const MOCK_USER_CODE = 'ABCD1234'

const PAGE_SIZE = 50

export interface MockConsoleState {
  account: ConsoleAccount
  workspaces: Map<string, ConsoleWorkspace>
  memory: Map<string, ConsoleWorkspaceMemory>
  leaderboard: LeaderboardFeed
  modelRates: ModelRatesFeed
  watches: Map<string, ConsoleWatch>
  events: WatchEvent[]
  /** How many token polls answer `authorization_pending` before the key. */
  pendingPolls: number
  /** When true, the device flow answers `access_denied`. */
  denySignIn: boolean
  /** The install id each device authorization named, in order. */
  installIds: Array<string | null>
  /** Redrob Cloud files; see design.ts. */
  design: MockDesignState
  /** Every request, for assertions. */
  requests: Array<{ method: string; path: string; authorized: boolean }>
}

const NOW = '2026-10-06T09:00:00.000Z'

export function mockConsoleState(): MockConsoleState {
  return {
    account: {
      id: 'user-1',
      name: 'Jane Designer',
      email: 'jane@example.com',
      currentWorkspaceId: 'ws-1',
      workspaces: [
        { id: 'ws-1', name: 'Redrob Office', role: 'admin' },
        { id: 'ws-2', name: 'Side project', role: 'developer' }
      ],
      device: null
    },
    workspaces: new Map([
      [
        'ws-1',
        {
          id: 'ws-1',
          name: 'Redrob Office',
          sources: [
            { id: 'src-site', name: 'redrob.io', kind: 'site', location: 'https://redrob.io' },
            { id: 'src-sheet', name: 'Pricing sheet, Q4', kind: 'sheet', location: null }
          ],
          policy: { privacyLevel: 'strict' }
        }
      ],
      ['ws-2', { id: 'ws-2', name: 'Side project', sources: [], policy: { privacyLevel: null } }]
    ]),
    memory: new Map([
      [
        'ws-1',
        {
          owner: 'Redrob Office',
          revision: 3,
          updatedAt: NOW,
          colors: [
            {
              name: 'Redrob Blue',
              note: 'Actions and links',
              swatches: [{ token: 'action-primary', hex: '#2B52FF' }]
            }
          ],
          typefaces: [{ family: 'Pretendard', note: 'Interface' }],
          radii: [4, 8, 12],
          rules: [
            { id: 'rule-voice', text: 'Sentence case everywhere.', source: 'redrob.io/brand' }
          ],
          components: ['Button', 'Card'],
          prices: [{ plan: 'Team', price: '$24' }]
        }
      ]
    ]),
    leaderboard: {
      name: 'Redrob Leaderboard',
      edition: 'October 2026',
      note: 'Updated monthly',
      publishedAt: NOW,
      picks: [
        {
          id: 'screens-1',
          model: 'Claude Opus 5.5',
          short: 'Opus 5.5',
          harness: 'Redrob Design',
          effort: { label: 'High', level: 3, of: 5 },
          why: 'Best layouts in the October run.',
          monthly: 42
        }
      ],
      rates: { KRW: 1390, INR: 96 }
    },
    modelRates: {
      publishedAt: NOW,
      rates: [{ match: 'opus', inputPerMillion: 15, outputPerMillion: 75 }]
    },
    watches: new Map(),
    events: [],
    pendingPolls: 1,
    denySignIn: false,
    installIds: [],
    design: mockDesignState(),
    requests: []
  }
}

function fail(c: Context, status: 400 | 401 | 403 | 404 | 409 | 412 | 429, error: string) {
  return c.json({ error }, status)
}

function page<T>(items: readonly T[], cursor: string | undefined) {
  const start = cursor ? Number(cursor) : 0
  const slice = items.slice(start, start + PAGE_SIZE)
  const next = start + PAGE_SIZE < items.length ? String(start + PAGE_SIZE) : null
  return { items: slice, nextCursor: next }
}

async function body<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T> | null> {
  const parsed = schema.safeParse(await c.req.json().catch(() => null))
  return parsed.success ? parsed.data : null
}

function etagOf(revision: number | string): string {
  return `"${revision}"`
}

let counter = 0
function nextId(prefix: string): string {
  counter += 1
  return `${prefix}-${counter}`
}

export function createMockConsole(state: MockConsoleState = mockConsoleState()) {
  const app = new Hono()

  app.use('*', async (c, next) => {
    const authorized = c.req.header('authorization') === `Bearer ${MOCK_TOKEN}`
    state.requests.push({ method: c.req.method, path: new URL(c.req.url).pathname, authorized })
    await next()
  })

  // Device flow (RFC 8628), as the app's device-connect client speaks it.
  app.post('/device/authorize', async (c) => {
    const request = (await c.req.json().catch(() => null)) as {
      product?: unknown
      installId?: unknown
    } | null
    if (typeof request?.product !== 'string') return fail(c, 400, 'invalid_request')
    // Console keeps one Design Cloud key per installation, so it must say which one is asking.
    if (
      request.product === 'design-cloud' &&
      (typeof request.installId !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(request.installId))
    ) {
      return fail(c, 400, 'invalid_request')
    }
    state.installIds.push(typeof request.installId === 'string' ? request.installId : null)
    return c.json({
      deviceCode: `device-${request.product}`,
      userCode: MOCK_USER_CODE,
      verificationUri: 'https://console.redrob.ai/connect',
      verificationUriComplete: `https://console.redrob.ai/connect?code=${MOCK_USER_CODE}`,
      expiresIn: 600,
      interval: 1
    })
  })
  app.post('/device/token', (c) => {
    if (state.denySignIn) return fail(c, 403, 'access_denied')
    if (state.pendingPolls > 0) {
      state.pendingPolls -= 1
      return fail(c, 400, 'authorization_pending')
    }
    return c.json({
      apiKey: MOCK_TOKEN,
      apiKeyName: 'Redrob Design Cloud',
      accountName: state.account.name
    })
  })

  // Public feeds.
  app.get('/feeds/leaderboard', (c) => c.json(state.leaderboard))
  app.get('/feeds/model-rates', (c) => c.json(state.modelRates))

  // Everything else takes the session token.
  const authed = new Hono()
  authed.use('*', async (c, next) => {
    if (c.req.header('authorization') !== `Bearer ${MOCK_TOKEN}`)
      return fail(c, 401, 'unauthorized')
    await next()
  })

  authed.get('/design/me', (c) => c.json(state.account))
  authed.put('/design/devices/current', async (c) => {
    const request = await body(c, registerDeviceSchema)
    if (!request) return fail(c, 400, 'invalid_request')
    const existing = state.account.device
    const device =
      existing?.publicKey === request.publicKey
        ? existing
        : {
            id: existing?.id ?? nextId('device'),
            publicKey: request.publicKey,
            createdAt: existing?.createdAt ?? NOW,
            updatedAt: NOW
          }
    state.account = { ...state.account, device }
    return c.json(device)
  })

  function member(workspaceId: string): boolean {
    return state.account.workspaces.some((workspace) => workspace.id === workspaceId)
  }

  authed.get('/workspaces/:workspaceId', (c) => {
    const workspace = state.workspaces.get(c.req.param('workspaceId'))
    if (!workspace) return fail(c, 404, 'not_found')
    if (!member(workspace.id)) return fail(c, 403, 'forbidden')
    return c.json(workspace)
  })
  authed.get('/workspaces/:workspaceId/memory', (c) => {
    const memory = state.memory.get(c.req.param('workspaceId'))
    if (!memory) return fail(c, 404, 'not_found')
    c.header('ETag', etagOf(memory.revision))
    return c.json(memory)
  })

  authed.post('/watches', async (c) => {
    const request = await body(c, createWatchSchema)
    if (!request) return fail(c, 400, 'invalid_request')
    const watch: ConsoleWatch = { ...request, id: nextId('watch'), createdAt: NOW }
    state.watches.set(watch.id, watch)
    return c.json(watch, 201)
  })
  authed.delete('/watches/:watchId', (c) => {
    if (!state.watches.delete(c.req.param('watchId'))) return fail(c, 404, 'not_found')
    return c.body(null, 204)
  })
  authed.get('/watches/events', (c) => {
    const since = c.req.query('since')
    const start = since ? Number(since) : state.events.length
    const mine = new Set(state.watches.keys())
    const items = state.events.slice(start).filter((event) => mine.has(event.watchId))
    return c.json({ items, nextCursor: String(state.events.length) })
  })

  registerDesignFiles({
    app,
    authed,
    state: state.design,
    self: () => state.account,
    authorized: (c) => c.req.header('authorization') === `Bearer ${MOCK_TOKEN}`,
    fail
  })

  app.route('/', authed)
  app.notFound((c) => fail(c, 404, 'not_found'))
  return { app, state }
}

export type MockConsole = ReturnType<typeof createMockConsole>

/** Base paths the mock answers under: real Console's and a short one for tests. */
export const MOCK_BASE_PATHS = ['/api/backend/v1', '/v1'] as const

/** A fetch that answers from the mock, as the app's Console client would call Console. */
export function mockConsoleFetch(mock: MockConsole) {
  return (input: string, init?: RequestInit): Promise<Response> => {
    const url = new URL(input)
    if (url.origin === BLOB_ORIGIN) return answerBlob(mock.state.design, url, init)
    const prefix = MOCK_BASE_PATHS.find((base) => url.pathname.startsWith(base)) ?? ''
    const path = `${url.pathname.slice(prefix.length)}${url.search}`
    return Promise.resolve(mock.app.fetch(new Request(`http://mock${path}`, init)))
  }
}

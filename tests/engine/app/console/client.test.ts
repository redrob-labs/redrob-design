import { afterEach, describe, expect, test } from 'bun:test'

import {
  CONSOLE_SESSION_REF,
  ConsoleError,
  cloudState,
  createConsoleClient,
  createMemorySnapshotCache,
  refreshCloudAccount,
  setConsoleCacheForTests,
  setConsoleClientForTests,
  signInToCloud,
  signOutOfCloud
} from '@/app/integrations/console'
import { appCredentialServices } from '@/app/settings/credentials/app'
import { providerCredentialRef } from '@/app/settings/credentials/migration'

import {
  MOCK_TOKEN,
  MOCK_USER_CODE,
  createMockConsole,
  mockConsoleFetch,
  mockConsoleState
} from '#tests/helpers/console/server'

const BASE = 'https://console.mock/v1'

function setup(token: string | null = MOCK_TOKEN) {
  const mock = createMockConsole()
  const client = createConsoleClient({
    baseURL: BASE,
    token: () => Promise.resolve(token),
    fetch: mockConsoleFetch(mock)
  })
  return { mock, client }
}

async function failure(promise: Promise<unknown>): Promise<ConsoleError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof ConsoleError) return error
    throw error
  }
  throw new Error('expected a ConsoleError')
}

afterEach(async () => {
  setConsoleClientForTests(null)
  setConsoleCacheForTests(null)
  await appCredentialServices.manager.clear(CONSOLE_SESSION_REF)
})

describe('Console client', () => {
  test('reads the account and checks it against the contract', async () => {
    const { client } = setup()
    const { data } = await client.call('getMe')
    expect(data.workspaces.map((workspace) => workspace.id)).toEqual(['ws-1', 'ws-2'])
  })

  test('public feeds need no sign-in; the rest refuse without a token', async () => {
    const { client, mock } = setup(null)
    expect((await client.call('getLeaderboardFeed')).data.edition).toBe('October 2026')
    expect((await failure(client.call('getMe'))).kind).toBe('not-signed-in')
    expect(mock.state.requests.some((request) => request.path === '/design/me')).toBe(false)
  })

  test('maps Console errors to what the app acts on', async () => {
    const { client } = setup('wrong-token')
    const unauthorized = await failure(client.call('getMe'))
    expect(unauthorized).toMatchObject({ kind: 'not-signed-in', status: 401, code: 'unauthorized' })
    const missing = await failure(
      setup().client.call('getWorkspace', { params: { workspaceId: 'nope' } })
    )
    expect(missing).toMatchObject({ kind: 'not-found', code: 'not_found' })
  })

  test('keeps ETags and honours If-Match', async () => {
    const { client, mock } = setup()
    const memory = await client.call('getWorkspaceMemory', { params: { workspaceId: 'ws-1' } })
    expect(memory.etag).toBe('"3"')

    const fileId = 'dfl_00000000000000000000000000000001'
    mock.state.design.files.set(fileId, {
      id: fileId,
      encryptedName: 'c2VhbGVk',
      role: 'owner',
      keyEpoch: 1,
      snapshotRevision: 0,
      createdAt: '2026-10-06T09:00:00.000Z',
      updatedAt: '2026-10-06T09:00:00.000Z'
    })
    mock.state.design.members.set(fileId, [
      {
        userId: 'user-1',
        email: 'jane@example.com',
        name: 'Jane',
        role: 'owner',
        addedAt: '2026-10-06T09:00:00.000Z'
      }
    ])
    const created = await client.call('createComment', {
      params: { fileId },
      body: {
        id: 'comment-0001',
        threadId: null,
        ciphertext: 'c2VhbGVk',
        epoch: 1,
        createdAt: '2026-10-06T09:00:00.000Z'
      }
    })
    const update = (ifMatch: string) =>
      client.call('updateComment', {
        params: { fileId, commentId: 'comment-0001' },
        body: { resolved: true },
        ifMatch
      })
    expect((await failure(update('"stale"'))).kind).toBe('conflict')
    expect((await update(`"${created.data.updatedAt}"`)).data.resolved).toBe(true)
  })

  test('reads Retry-After on rate limits', async () => {
    const client = createConsoleClient({
      baseURL: BASE,
      token: () => Promise.resolve(MOCK_TOKEN),
      fetch: () =>
        Promise.resolve(
          new Response(JSON.stringify({ error: 'rate_limited' }), {
            status: 429,
            headers: { 'Retry-After': '7' }
          })
        )
    })
    expect(await failure(client.call('getMe'))).toMatchObject({
      kind: 'rate-limited',
      retryAfter: 7
    })
  })

  test('refuses answers that do not match the contract or are too large', async () => {
    const answer = (body: string) =>
      createConsoleClient({
        baseURL: BASE,
        token: () => Promise.resolve(MOCK_TOKEN),
        maxResponseBytes: 64,
        fetch: () => Promise.resolve(new Response(body, { status: 200 }))
      })
    expect((await failure(answer('{"id":1}').call('getMe'))).kind).toBe('invalid')
    expect((await failure(answer(`"${'x'.repeat(100)}"`).call('getMe'))).kind).toBe('invalid')
  })

  test('reports Console it cannot reach', async () => {
    const client = createConsoleClient({
      baseURL: BASE,
      token: () => Promise.resolve(MOCK_TOKEN),
      fetch: () => Promise.reject(new TypeError('Failed to fetch'))
    })
    expect((await failure(client.call('getMe'))).kind).toBe('unreachable')
  })
})

describe('Redrob Cloud sign-in', () => {
  function cloudDeps(mock = createMockConsole()) {
    return {
      mock,
      deps: { fetch: mockConsoleFetch(mock), now: () => Date.now(), sleep: () => Promise.resolve() }
    }
  }

  test('signs in with the design-cloud device flow and keeps the token as a credential', async () => {
    setConsoleCacheForTests(createMemorySnapshotCache())
    const { mock, deps } = cloudDeps()
    setConsoleClientForTests(
      createConsoleClient({
        baseURL: BASE,
        token: () => appCredentialServices.resolver.resolve(CONSOLE_SESSION_REF),
        fetch: mockConsoleFetch(mock)
      })
    )
    const signingIn = signInToCloud(deps)
    expect(cloudState.status).toBe('signing-in')
    expect(await signingIn).toBe('signed-in')
    expect(cloudState.account?.name).toBe('Jane Designer')
    expect(await appCredentialServices.manager.status(CONSOLE_SESSION_REF)).toBe('configured')
    // The session token is not a model key.
    expect(CONSOLE_SESSION_REF).not.toEqual(providerCredentialRef('redrob', 'default'))
    expect(JSON.stringify(cloudState)).not.toContain(MOCK_TOKEN)
    expect(MOCK_USER_CODE).toBe('ABCD1234')

    await signOutOfCloud()
    expect(cloudState.status).toBe('signed-out')
    expect(await appCredentialServices.manager.status(CONSOLE_SESSION_REF)).toBe('missing')
  })

  test('names this installation, the same one every time, so other computers stay signed in', async () => {
    setConsoleCacheForTests(createMemorySnapshotCache())
    const { mock, deps } = cloudDeps()
    setConsoleClientForTests(
      createConsoleClient({
        baseURL: BASE,
        token: () => appCredentialServices.resolver.resolve(CONSOLE_SESSION_REF),
        fetch: mockConsoleFetch(mock)
      })
    )
    expect(await signInToCloud(deps)).toBe('signed-in')
    await signOutOfCloud()
    expect(await signInToCloud(deps)).toBe('signed-in')
    const [first, second] = mock.state.installIds
    expect(first).toMatch(/^[A-Za-z0-9_-]{16,64}$/)
    expect(second).toBe(first)
    expect(cloudState.account?.currentWorkspaceId).toBe('ws-1')
    await signOutOfCloud()
  })

  test('a refused sign-in leaves the person signed out', async () => {
    const state = mockConsoleState()
    state.denySignIn = true
    const { deps } = cloudDeps(createMockConsole(state))
    expect(await signInToCloud(deps)).toBe('signed-out')
    expect(cloudState.error).toBe('denied')
  })

  test('offline, the last known account stays; a rejected token signs out', async () => {
    setConsoleCacheForTests(createMemorySnapshotCache())
    await appCredentialServices.manager.set(CONSOLE_SESSION_REF, MOCK_TOKEN)
    const mock = createMockConsole()
    let online = true
    setConsoleClientForTests(
      createConsoleClient({
        baseURL: BASE,
        token: () => appCredentialServices.resolver.resolve(CONSOLE_SESSION_REF),
        fetch: (url, init) =>
          online ? mockConsoleFetch(mock)(url, init) : Promise.reject(new TypeError('offline'))
      })
    )
    await refreshCloudAccount()
    expect(cloudState.status).toBe('signed-in')
    online = false
    await refreshCloudAccount()
    expect(cloudState.status).toBe('signed-in')
    expect(cloudState.account?.name).toBe('Jane Designer')

    online = true
    await appCredentialServices.manager.set(CONSOLE_SESSION_REF, 'revoked-token')
    await refreshCloudAccount()
    expect(cloudState.status).toBe('signed-out')
    expect(await appCredentialServices.manager.status(CONSOLE_SESSION_REF)).toBe('missing')
  })
})

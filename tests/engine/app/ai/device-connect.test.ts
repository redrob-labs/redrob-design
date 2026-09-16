import { describe, expect, test } from 'bun:test'

import { REDROB_CONSOLE_API_BASE } from '@redrob-design/core/constants'

import {
  formatUserCode,
  pollDeviceToken,
  runDeviceConnect,
  startDeviceAuthorization,
  type DeviceAuthorization,
  type DeviceConnectDeps
} from '@/app/ai/connect/device-connect'

type Answer = { status: number; body: unknown } | { throws: true }

/**
 * A recording Console. Every queued answer is consumed by exactly one request, so a
 * test that expects three polls fails loudly if the loop makes two or four.
 */
function consoleStub(answers: Answer[]) {
  const calls: { url: string; body: unknown }[] = []
  const fetchImpl = async (url: string, init: RequestInit): Promise<Response> => {
    calls.push({ url, body: JSON.parse(String(init.body)) as unknown })
    const answer = answers.shift()
    if (!answer) throw new Error(`unexpected request to ${url}`)
    if ('throws' in answer) throw new Error('network down')
    return new Response(JSON.stringify(answer.body), { status: answer.status })
  }
  return { calls, fetchImpl, remaining: () => answers.length }
}

/** Time only moves when the loop waits, which makes expiry exact rather than flaky. */
function clockDeps(fetchImpl: DeviceConnectDeps['fetch']) {
  const waits: number[] = []
  let clock = 0
  return {
    waits,
    deps: {
      fetch: fetchImpl,
      now: () => clock,
      sleep: async (ms: number) => {
        waits.push(ms)
        clock += ms
      }
    } satisfies DeviceConnectDeps
  }
}

const authorization: DeviceAuthorization = {
  deviceCode: 'device-code-value',
  userCode: 'K7QM2XR9',
  verificationURI: 'https://console.redrob.ai/connect',
  verificationURIComplete: 'https://console.redrob.ai/connect?code=K7QM-2XR9',
  expiresIn: 600,
  interval: 5
}

describe('Connect Redrob device authorization', () => {
  test('posts the product id and returns the codes', async () => {
    const stub = consoleStub([
      {
        status: 200,
        body: {
          deviceCode: 'dc',
          userCode: 'ABCD2345',
          verificationURI: 'https://console.redrob.ai/connect',
          expiresIn: 600,
          interval: 5
        }
      }
    ])

    const result = await startDeviceAuthorization('design', { fetch: stub.fetchImpl })

    expect(stub.calls[0]?.url).toBe(`${REDROB_CONSOLE_API_BASE}/device/authorize`)
    expect(stub.calls[0]?.body).toEqual({ product: 'design' })
    expect(result.userCode).toBe('ABCD2345')
    // Console may omit the pre-filled URL; the plain one stands in rather than undefined.
    expect(result.verificationURIComplete).toBe('https://console.redrob.ai/connect')
  })

  test('refuses an incomplete authorization instead of polling forever', async () => {
    const stub = consoleStub([{ status: 200, body: { userCode: 'ABCD2345' } }])
    await expect(startDeviceAuthorization('design', { fetch: stub.fetchImpl })).rejects.toThrow(
      /incomplete device authorization/
    )
  })
})

describe('Connect Redrob poll loop', () => {
  test('waits before the first poll, then returns the key', async () => {
    const stub = consoleStub([
      { status: 400, body: { error: 'authorization_pending' } },
      { status: 200, body: { apiKey: 'rrk_prefix_secret', accountName: 'Redrob' } }
    ])
    const clock = clockDeps(stub.fetchImpl)

    const outcome = await runDeviceConnect({ authorization, deps: clock.deps })

    expect(clock.waits[0]).toBe(5000)
    expect(stub.calls).toHaveLength(2)
    expect(stub.calls[0]?.body).toEqual({ deviceCode: 'device-code-value' })
    expect(outcome).toEqual({
      status: 'connected',
      key: { apiKey: 'rrk_prefix_secret', accountName: 'Redrob' }
    })
  })

  test('doubles the interval on slow_down, up to the cap', async () => {
    const stub = consoleStub([
      { status: 400, body: { error: 'slow_down' } },
      { status: 400, body: { error: 'slow_down' } },
      { status: 400, body: { error: 'slow_down' } },
      { status: 400, body: { error: 'slow_down' } },
      { status: 200, body: { apiKey: 'rrk_prefix_secret' } }
    ])
    const clock = clockDeps(stub.fetchImpl)

    await runDeviceConnect({ authorization, deps: clock.deps })

    expect(clock.waits).toEqual([5000, 10_000, 20_000, 30_000, 30_000])
  })

  test('stops on a denial rather than retrying it', async () => {
    const stub = consoleStub([{ status: 403, body: { error: 'access_denied' } }])
    const clock = clockDeps(stub.fetchImpl)

    expect(await runDeviceConnect({ authorization, deps: clock.deps })).toEqual({
      status: 'denied'
    })
    expect(stub.remaining()).toBe(0)
  })

  test('stops when Console says the code expired', async () => {
    const stub = consoleStub([{ status: 400, body: { error: 'expired_token' } }])
    const clock = clockDeps(stub.fetchImpl)

    expect(await runDeviceConnect({ authorization, deps: clock.deps })).toEqual({
      status: 'expired'
    })
  })

  test('reports an unknown refusal by its code instead of looping', async () => {
    const stub = consoleStub([{ status: 400, body: { error: 'invalid_grant' } }])
    const clock = clockDeps(stub.fetchImpl)

    expect(await runDeviceConnect({ authorization, deps: clock.deps })).toEqual({
      status: 'failed',
      code: 'invalid_grant'
    })
  })

  test('treats a key-less success as a failure, not a connection', async () => {
    const stub = consoleStub([{ status: 200, body: { accountName: 'Redrob' } }])
    const clock = clockDeps(stub.fetchImpl)

    expect(await runDeviceConnect({ authorization, deps: clock.deps })).toEqual({
      status: 'failed',
      code: 'missing_key'
    })
  })

  test('gives up after five consecutive unreachable polls', async () => {
    const stub = consoleStub(Array.from({ length: 5 }, () => ({ throws: true }) as Answer))
    const clock = clockDeps(stub.fetchImpl)

    expect(await runDeviceConnect({ authorization, deps: clock.deps })).toEqual({
      status: 'unreachable',
      attempts: 5
    })
  })

  test('keeps going when a blip is followed by a real answer', async () => {
    const stub = consoleStub([
      { throws: true },
      { status: 400, body: { error: 'authorization_pending' } },
      { throws: true },
      { status: 200, body: { apiKey: 'rrk_prefix_secret' } }
    ])
    const clock = clockDeps(stub.fetchImpl)

    expect(await runDeviceConnect({ authorization, deps: clock.deps })).toEqual({
      status: 'connected',
      key: { apiKey: 'rrk_prefix_secret' }
    })
  })

  test('retries a 5xx as unreachable rather than calling it a verdict', async () => {
    const stub = consoleStub([{ status: 503, body: {} }])
    expect(await pollDeviceToken('dc', { fetch: stub.fetchImpl })).toEqual({ kind: 'unreachable' })
  })

  test('expires on its own once the deadline passes', async () => {
    const stub = consoleStub(
      Array.from(
        { length: 200 },
        () =>
          ({
            status: 400,
            body: { error: 'authorization_pending' }
          }) as Answer
      )
    )
    const clock = clockDeps(stub.fetchImpl)

    // 60s of validity at a 5s interval. The deadline is checked after each wait and
    // before the poll, so the wait landing exactly on 60s expires: eleven polls.
    expect(
      await runDeviceConnect({
        authorization: { ...authorization, expiresIn: 60 },
        deps: clock.deps
      })
    ).toEqual({ status: 'expired' })
    expect(stub.calls).toHaveLength(11)
  })

  test('stops when the caller cancels, without polling at all', async () => {
    const stub = consoleStub([{ status: 400, body: { error: 'authorization_pending' } }])
    const clock = clockDeps(stub.fetchImpl)
    let cancelled = false

    const outcome = await runDeviceConnect({
      authorization,
      deps: clock.deps,
      isCancelled: () => {
        const now = cancelled
        cancelled = true
        return now
      }
    })

    expect(outcome).toEqual({ status: 'cancelled' })
    expect(stub.calls).toHaveLength(0)
  })
})

describe('formatUserCode', () => {
  test('groups eight characters and drops anything else', () => {
    expect(formatUserCode('k7qm2xr9')).toBe('K7QM-2XR9')
    expect(formatUserCode('K7QM-2XR9')).toBe('K7QM-2XR9')
    expect(formatUserCode('k7q')).toBe('K7Q')
    expect(formatUserCode('K7QM2XR9EXTRA')).toBe('K7QM-2XR9')
  })
})

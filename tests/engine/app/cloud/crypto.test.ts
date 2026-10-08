import 'fake-indexeddb/auto'
import { afterEach, describe, expect, test } from 'bun:test'

import {
  CloudCryptoError,
  cacheFileKey,
  cachedFileKey,
  deviceKeyPair,
  envelopeEpoch,
  exportDevicePublicKey,
  forgetFileKeys,
  generateContentKey,
  importContentKey,
  open,
  resetKeystoreForTests,
  seal,
  unwrapContentKey,
  wrapContentKey
} from '@/app/cloud/crypto'
import { registerCloudDevice } from '@/app/cloud/device'
import {
  CONSOLE_SESSION_REF,
  cloudState,
  createConsoleClient,
  devicePublicKey,
  setConsoleClientForTests
} from '@/app/integrations/console'
import { appCredentialServices } from '@/app/settings/credentials/app'

import { MOCK_TOKEN, createMockConsole, mockConsoleFetch } from '#tests/helpers/console/server'

const text = (value: string) => new TextEncoder().encode(value)
const read = (bytes: Uint8Array) => new TextDecoder().decode(bytes)

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('expected a rejection')
}

async function newDevice() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, [
    'deriveBits'
  ])
  return { privateKey: pair.privateKey, publicKey: await exportDevicePublicKey(pair.publicKey) }
}

afterEach(() => {
  resetKeystoreForTests()
  setConsoleClientForTests(null)
})

describe('content envelopes', () => {
  test('seal and open round-trip, and say which epoch they were sealed under', async () => {
    const key = await importContentKey(generateContentKey())
    const envelope = await seal(
      key,
      { fileId: 'dfl_1', epoch: 3, purpose: { kind: 'snapshot' } },
      text('the page')
    )
    expect(envelopeEpoch(envelope)).toBe(3)
    expect(
      read(await open(key, { fileId: 'dfl_1', purpose: { kind: 'snapshot' } }, envelope))
    ).toBe('the page')
  })

  test('two seals of the same bytes differ, so equal content is not visible', async () => {
    const key = await importContentKey(generateContentKey())
    const context = { fileId: 'dfl_1', epoch: 1, purpose: { kind: 'snapshot' } } as const
    const a = await seal(key, context, text('same'))
    const b = await seal(key, context, text('same'))
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false)
  })

  test('bytes moved to another file, purpose or sender do not open', async () => {
    const key = await importContentKey(generateContentKey())
    const frame = { kind: 'frame', namespace: 'yjs-update', senderId: 'peer-a' } as const
    const envelope = await seal(key, { fileId: 'dfl_1', epoch: 1, purpose: frame }, text('edit'))
    for (const context of [
      { fileId: 'dfl_2', purpose: frame },
      { fileId: 'dfl_1', purpose: { kind: 'snapshot' } },
      { fileId: 'dfl_1', purpose: { ...frame, senderId: 'peer-b' } },
      { fileId: 'dfl_1', purpose: { ...frame, namespace: 'awareness' } }
    ] as const) {
      expect(await rejection(open(key, context, envelope))).toBeInstanceOf(CloudCryptoError)
    }
  })

  test('a tampered byte or another key does not open', async () => {
    const key = await importContentKey(generateContentKey())
    const other = await importContentKey(generateContentKey())
    const context = { fileId: 'dfl_1', epoch: 1, purpose: { kind: 'comment' } } as const
    const envelope = await seal(key, context, text('hello'))
    const tampered = envelope.slice()
    tampered[tampered.length - 1] ^= 1
    expect(await rejection(open(key, context, tampered))).toBeInstanceOf(CloudCryptoError)
    expect(await rejection(open(other, context, envelope))).toBeInstanceOf(CloudCryptoError)
    expect(() => envelopeEpoch(new Uint8Array(4))).toThrow(CloudCryptoError)
  })

  test('the content key cannot be read back out of WebCrypto', async () => {
    const key = await importContentKey(generateContentKey())
    expect(key.extractable).toBe(false)
    expect(await rejection(importContentKey(new Uint8Array(16)))).toBeInstanceOf(CloudCryptoError)
  })
})

describe('wrapping a file key for a device', () => {
  test('only the device it was wrapped for can unwrap it', async () => {
    const raw = generateContentKey()
    const laptop = await newDevice()
    const stranger = await newDevice()
    const wrapped = await wrapContentKey(raw, laptop.publicKey, { fileId: 'dfl_1', epoch: 1 })
    expect(wrapped).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(wrapped.length).toBeLessThan(1024)
    const unwrapped = await unwrapContentKey(wrapped, laptop.privateKey, {
      fileId: 'dfl_1',
      epoch: 1
    })
    expect(Buffer.from(unwrapped).equals(Buffer.from(raw))).toBe(true)
    expect(
      await rejection(unwrapContentKey(wrapped, stranger.privateKey, { fileId: 'dfl_1', epoch: 1 }))
    ).toBeInstanceOf(CloudCryptoError)
  })

  test('a wrapped key moved to another file or epoch does not unwrap', async () => {
    const laptop = await newDevice()
    const wrapped = await wrapContentKey(generateContentKey(), laptop.publicKey, {
      fileId: 'dfl_1',
      epoch: 1
    })
    for (const context of [
      { fileId: 'dfl_2', epoch: 1 },
      { fileId: 'dfl_1', epoch: 2 }
    ]) {
      expect(await rejection(unwrapContentKey(wrapped, laptop.privateKey, context))).toBeInstanceOf(
        CloudCryptoError
      )
    }
    expect(
      await rejection(
        unwrapContentKey('not-a-key', laptop.privateKey, { fileId: 'dfl_1', epoch: 1 })
      )
    ).toBeInstanceOf(CloudCryptoError)
  })
})

describe('this installation’s keys', () => {
  test('the device key pair is made once, kept, and its private half is not extractable', async () => {
    const first = await deviceKeyPair()
    resetKeystoreForTests()
    const again = await deviceKeyPair()
    expect(again.publicKey).toBe(first.publicKey)
    expect(again.privateKey.extractable).toBe(false)
    expect(devicePublicKey.safeParse(first.publicKey).success).toBe(true)
  })

  test('file keys are kept per epoch and forgotten on sign-out', async () => {
    const key = await importContentKey(generateContentKey())
    await cacheFileKey('dfl_1', 1, key)
    expect(await cachedFileKey('dfl_1', 1)).not.toBeNull()
    expect(await cachedFileKey('dfl_1', 2)).toBeNull()
    await forgetFileKeys()
    expect(await cachedFileKey('dfl_1', 1)).toBeNull()
  })

  test('registers the public key with Console once, and leaves it alone when it matches', async () => {
    const mock = createMockConsole()
    await appCredentialServices.manager.set(CONSOLE_SESSION_REF, MOCK_TOKEN)
    setConsoleClientForTests(
      createConsoleClient({
        baseURL: 'https://console.mock/v1',
        token: () => appCredentialServices.resolver.resolve(CONSOLE_SESSION_REF),
        fetch: mockConsoleFetch(mock)
      })
    )
    cloudState.account = mock.state.account
    await registerCloudDevice()
    const pair = await deviceKeyPair()
    expect(mock.state.account.device?.publicKey).toBe(pair.publicKey)
    expect(cloudState.account?.device?.publicKey).toBe(pair.publicKey)
    const puts = () => mock.state.requests.filter((request) => request.method === 'PUT').length
    expect(puts()).toBe(1)
    await registerCloudDevice()
    expect(puts()).toBe(1)
    cloudState.account = null
    await appCredentialServices.manager.clear(CONSOLE_SESSION_REF)
  })
})

import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  SHARED_ACCOUNT_FILE,
  SHARED_DIR_ENV,
  cachedSharedAccountReader,
  parseSharedAccount,
  resolveWorkspaceKey,
  sharedAccountFileReader,
  type SharedAccountReader
} from '@/app/ai/connect/shared-account'
import { MemoryCredentialStore } from '@/app/settings/credentials/memory'
import { credentialRef } from '@/app/settings/credentials/reference'
import { createCredentialServices } from '@/app/settings/credentials/services'

/**
 * The launcher's directory, pointed at a scratch folder through the override every
 * Redrob app honours. Nothing here ever reads the real `~/.config`.
 */
let sharedDir = ''
let previousOverride: string | undefined

beforeAll(async () => {
  sharedDir = await mkdtemp(join(tmpdir(), 'redrob-design-shared-account-'))
  previousOverride = process.env[SHARED_DIR_ENV]
  process.env[SHARED_DIR_ENV] = sharedDir
})

afterAll(async () => {
  if (previousOverride === undefined) delete process.env.REDROB_SHARED_DIR
  else process.env[SHARED_DIR_ENV] = previousOverride
  await rm(sharedDir, { recursive: true, force: true })
})

afterEach(async () => {
  await unlink(sharedAccountFile()).catch(() => undefined)
})

function sharedAccountFile(): string {
  const dir = process.env[SHARED_DIR_ENV]
  if (!dir) throw new Error(`${SHARED_DIR_ENV} is not set`)
  return join(dir, SHARED_ACCOUNT_FILE)
}

/** Reads the file the way the desktop side does, resolving to `null` when it is absent. */
function readTextOrNull(path: string): Promise<string | null> {
  return readFile(path, 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null
    throw error
  })
}

function launcherReader(): SharedAccountReader {
  return sharedAccountFileReader(sharedAccountFile(), readTextOrNull)
}

async function launcherSignsIn(account: Record<string, unknown>): Promise<void> {
  await writeFile(sharedAccountFile(), JSON.stringify(account))
}

/** The app's own credential store and the reference its Redrob connection uses. */
function ownStore() {
  const store = new MemoryCredentialStore()
  const services = createCredentialServices(store)
  const reference = credentialRef('redrob', 'api-key')
  return {
    services,
    reference,
    own: () => services.resolver.resolve(reference)
  }
}

const launcherAccount = {
  apiKey: 'rrk_launcher_value',
  apiKeyName: 'laptop',
  accountName: 'Redrob',
  apiBaseUrl: 'https://console.redrob.ai/api/backend/v1'
}

describe('parseSharedAccount', () => {
  test('maps the launcher file to the app credential shape', () => {
    expect(parseSharedAccount(JSON.stringify(launcherAccount))).toEqual({
      apiKey: 'rrk_launcher_value',
      apiKeyName: 'laptop',
      accountName: 'Redrob',
      apiBaseURL: 'https://console.redrob.ai/api/backend/v1'
    })
  })

  test('treats a missing or empty key, and anything that is not the file, as signed out', () => {
    expect(parseSharedAccount('{"apiKey":""}')).toBeNull()
    expect(parseSharedAccount('{"apiKey":"   "}')).toBeNull()
    expect(parseSharedAccount('{"accountName":"Redrob"}')).toBeNull()
    expect(parseSharedAccount('{"apiKey":42}')).toBeNull()
    expect(parseSharedAccount('[]')).toBeNull()
    expect(parseSharedAccount('null')).toBeNull()
    expect(parseSharedAccount('{"apiKey":"rrk_x"')).toBeNull()
  })
})

describe('Redrob Launcher shared sign-in as the fallback key', () => {
  test('no key anywhere means not signed in', async () => {
    const { own } = ownStore()
    expect(await resolveWorkspaceKey(own, launcherReader())).toBeNull()
  })

  test('the shared file alone is used and flagged as the launcher', async () => {
    await launcherSignsIn(launcherAccount)
    const { own } = ownStore()

    expect(await resolveWorkspaceKey(own, launcherReader())).toEqual({
      apiKey: 'rrk_launcher_value',
      source: 'launcher',
      accountName: 'Redrob',
      apiKeyName: 'laptop',
      apiBaseURL: 'https://console.redrob.ai/api/backend/v1'
    })
  })

  test("the app's own key wins over the shared file, which is not even read", async () => {
    await launcherSignsIn(launcherAccount)
    const { services, reference, own } = ownStore()
    await services.manager.set(reference, 'rrk_own_value')
    let sharedReads = 0
    const counted: SharedAccountReader = async () => {
      sharedReads += 1
      return launcherReader()()
    }

    expect(await resolveWorkspaceKey(own, counted)).toEqual({
      apiKey: 'rrk_own_value',
      source: 'own'
    })
    expect(sharedReads).toBe(0)
  })

  test('disconnecting removes only the own key; the shared file survives and takes over', async () => {
    await launcherSignsIn(launcherAccount)
    const { services, reference, own } = ownStore()
    await services.manager.set(reference, 'rrk_own_value')

    await services.manager.clear(reference)

    expect(await services.manager.status(reference)).toBe('missing')
    expect(JSON.parse(await readFile(sharedAccountFile(), 'utf8'))).toEqual(launcherAccount)
    expect(await resolveWorkspaceKey(own, launcherReader())).toMatchObject({
      apiKey: 'rrk_launcher_value',
      source: 'launcher'
    })
  })

  test('removing the shared file signs the app out again, at the next read', async () => {
    await launcherSignsIn(launcherAccount)
    const { own } = ownStore()
    const reader = launcherReader()
    expect(await resolveWorkspaceKey(own, reader)).not.toBeNull()

    await unlink(sharedAccountFile())

    expect(await resolveWorkspaceKey(own, reader)).toBeNull()
  })

  test('a shared file with an empty key is not signed in', async () => {
    await launcherSignsIn({ ...launcherAccount, apiKey: '' })
    const { own } = ownStore()
    expect(await resolveWorkspaceKey(own, launcherReader())).toBeNull()
  })

  test('a reader over an unknown path or an unreadable file is not signed in', async () => {
    expect(await sharedAccountFileReader(null, readTextOrNull)()).toBeNull()
    const failing = sharedAccountFileReader('anywhere', async () => {
      throw new Error('EACCES')
    })
    expect(await failing()).toBeNull()
  })
})

describe('cachedSharedAccountReader', () => {
  test('reads once within the ttl and again after it, so a launcher sign-out lands in seconds', async () => {
    let clock = 0
    let reads = 0
    let onDisk: string | null = JSON.stringify(launcherAccount)
    const reader = cachedSharedAccountReader(
      sharedAccountFileReader('account.json', async () => {
        reads += 1
        return onDisk
      }),
      { now: () => clock, ttlMs: 3_000 }
    )

    expect((await reader())?.apiKey).toBe('rrk_launcher_value')
    clock = 1_000
    expect((await reader())?.apiKey).toBe('rrk_launcher_value')
    expect(reads).toBe(1)

    onDisk = null
    clock = 2_999
    expect(await reader()).not.toBeNull()
    clock = 3_000
    expect(await reader()).toBeNull()
    expect(reads).toBe(2)
  })
})

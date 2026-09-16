// Contract: the root shims actually run their implementation.
//
// The architecture gate requires implementation under tools/ and a tiny shim in scripts/. The first
// version of that split left the CLI body behind an `import.meta.main` guard, which is FALSE in an
// imported module -- so the shim exited 0 having done nothing, the release build ran without the
// updater overlay, and no update artefacts were produced. Nothing failed; it just silently did not
// happen. These tests run the shims as real subprocesses so the same mistake cannot pass again.
import { describe, expect, test } from 'bun:test'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const repoRoot = join(import.meta.dir, '..', '..', '..')

async function scratch(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'updater-shim-'))
}

describe('scripts/tauri-updater-overlay.ts', () => {
  test('writes the overlay when a public key is configured', async () => {
    const output = join(await scratch(), 'overlay.json')
    const result = Bun.spawnSync({
      cmd: ['bun', 'scripts/tauri-updater-overlay.ts', output],
      cwd: repoRoot,
      env: { ...process.env, TAURI_SIGNING_PUBLIC_KEY: 'test-public-key' }
    })

    expect(result.exitCode).toBe(0)
    const overlay = JSON.parse(await readFile(output, 'utf8')) as {
      bundle: { createUpdaterArtifacts: boolean }
      plugins: { updater: { pubkey: string } }
    }
    expect(overlay.bundle.createUpdaterArtifacts).toBe(true)
    expect(overlay.plugins.updater.pubkey).toBe('test-public-key')
  })

  test('writes nothing and stays green with no public key', async () => {
    const output = join(await scratch(), 'overlay.json')
    const result = Bun.spawnSync({
      cmd: ['bun', 'scripts/tauri-updater-overlay.ts', output],
      cwd: repoRoot,
      env: { ...process.env, TAURI_SIGNING_PUBLIC_KEY: '', TAURI_SIGNING_PRIVATE_KEY: '' }
    })

    expect(result.exitCode).toBe(0)
    expect(new TextDecoder().decode(result.stdout)).toContain('produces no update artefacts')
    expect(await Bun.file(output).exists()).toBe(false)
  })
})

describe('scripts/build-updater-feed.ts', () => {
  test('writes the feed from the fragments on disk', async () => {
    const dir = await scratch()
    await Bun.write(
      join(dir, 'linux.updater.json'),
      JSON.stringify({
        platform: 'linux-x86_64',
        file: 'redrob-design-x64-0.14.0.AppImage',
        signature: 'sig-linux'
      })
    )
    const output = join(dir, 'latest.json')

    const result = Bun.spawnSync({
      cmd: [
        'bun',
        'scripts/build-updater-feed.ts',
        dir,
        '0.14.0',
        'https://cdn.redrob.ai/design/latest',
        output
      ],
      cwd: repoRoot
    })

    expect(result.exitCode).toBe(0)
    const feed = JSON.parse(await readFile(output, 'utf8')) as {
      version: string
      platforms: Record<string, { url: string; signature: string }>
    }
    expect(feed.version).toBe('0.14.0')
    expect(feed.platforms['linux-x86_64']).toEqual({
      signature: 'sig-linux',
      url: 'https://cdn.redrob.ai/design/latest/redrob-design-x64-0.14.0.AppImage'
    })
  })

  test('fails loudly when there is no signed fragment at all', async () => {
    // A feed built from nothing would advertise an update no platform can install, so this must be a
    // non-zero exit rather than an empty file.
    const dir = await scratch()
    const result = Bun.spawnSync({
      cmd: [
        'bun',
        'scripts/build-updater-feed.ts',
        dir,
        '0.14.0',
        'https://cdn.redrob.ai/design/latest',
        join(dir, 'latest.json')
      ],
      cwd: repoRoot
    })

    expect(result.exitCode).not.toBe(0)
    expect(new TextDecoder().decode(result.stderr)).toContain('no platform can install')
  })
})

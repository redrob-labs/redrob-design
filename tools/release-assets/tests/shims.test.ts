// Contract: the root shims actually run, as subprocesses, for the reason recorded in
// tools/updater/tests/shims.test.ts -- an `import.meta.main` guard once made a shim exit 0 doing nothing.
import { describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { LAUNCHER_MANIFEST_NAME, launcherManifestText } from '../src/launcher-manifest'

const repoRoot = join(import.meta.dir, '..', '..', '..')

async function stagingWith(names: string[]): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'release-assets-'))
  for (const name of names) await writeFile(join(dir, name), name)
  return dir
}

function check(dir: string, version: string, ...requirements: string[]) {
  const result = Bun.spawnSync({
    cmd: [
      'bun',
      'scripts/check-release-assets.ts',
      dir,
      version,
      ...requirements.flatMap((requirement) => ['--require', requirement])
    ],
    cwd: repoRoot
  })
  return {
    exitCode: result.exitCode,
    stdout: new TextDecoder().decode(result.stdout),
    stderr: new TextDecoder().decode(result.stderr)
  }
}

describe('scripts/write-launcher-manifest.ts', () => {
  test('writes the manifest the release job uploads, and the check then passes', async () => {
    const dir = await stagingWith(['redrob-design-0.15.1-linux-x86_64.AppImage'])
    const written = Bun.spawnSync({
      cmd: ['bun', 'scripts/write-launcher-manifest.ts', dir],
      cwd: repoRoot
    })
    expect(written.exitCode).toBe(0)
    expect(await readFile(join(dir, LAUNCHER_MANIFEST_NAME), 'utf8')).toBe(launcherManifestText())

    const result = check(dir, 'v0.15.1', 'linux-x86_64:AppImage')
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain(`companion    ${LAUNCHER_MANIFEST_NAME}`)
  })

  test('refuses to run without a directory', () => {
    const result = Bun.spawnSync({
      cmd: ['bun', 'scripts/write-launcher-manifest.ts'],
      cwd: repoRoot
    })
    expect(result.exitCode).not.toBe(0)
  })
})

describe('scripts/check-release-assets.ts', () => {
  test('passes a correctly named staging directory that carries the launcher manifest', async () => {
    const dir = await stagingWith([
      'redrob-design-0.15.1-linux-x86_64.AppImage',
      'redrob-design-0.15.1-windows-x64.msi'
    ])
    await writeFile(join(dir, LAUNCHER_MANIFEST_NAME), launcherManifestText())
    const result = check(dir, 'v0.15.1', 'linux-x86_64:AppImage', 'windows-x64:msi')
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('2 launcher-installable asset(s)')
  })

  test('fails a release directory without redrob-launcher.json', async () => {
    const dir = await stagingWith(['redrob-design-0.15.1-linux-x86_64.AppImage'])
    const result = check(dir, '0.15.1', 'linux-x86_64:AppImage')
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain('missing redrob-launcher.json')
  })

  test('fails a manifest that does not say what this app does', async () => {
    const dir = await stagingWith(['redrob-design-0.15.1-linux-x86_64.AppImage'])
    await writeFile(join(dir, LAUNCHER_MANIFEST_NAME), '{ "schema": 1, "sharedAccount": false }\n')
    const result = check(dir, '0.15.1')
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain('sharedAccount must be true')
  })

  test("fails on a bundle the workflow forgot to rename, and on a platform that didn't ship", async () => {
    const dir = await stagingWith(['Redrob.Design_0.15.1_aarch64.dmg'])
    const result = check(dir, '0.15.1', 'macos-aarch64:dmg')
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain('Redrob Launcher cannot read this name')
    expect(result.stderr).toContain('missing redrob-design-0.15.1-macos-aarch64.dmg')
  })

  test('fails on an empty directory rather than publishing nothing', async () => {
    const dir = await stagingWith([])
    const result = check(dir, '0.15.1')
    expect(result.exitCode).not.toBe(0)
  })
})

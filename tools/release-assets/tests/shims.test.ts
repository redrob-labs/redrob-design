// Contract: the root shim actually runs the check, as a subprocess, for the reason recorded in
// tools/updater/tests/shims.test.ts -- an `import.meta.main` guard once made a shim exit 0 doing nothing.
import { describe, expect, test } from 'bun:test'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const repoRoot = join(import.meta.dir, '..', '..', '..')

async function stagingWith(names: string[]): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'release-assets-'))
  for (const name of names) await writeFile(join(dir, name), name)
  return dir
}

describe('scripts/check-release-assets.ts', () => {
  test('passes a correctly named staging directory', async () => {
    const dir = await stagingWith([
      'redrob-design-0.15.1-linux-x86_64.AppImage',
      'redrob-design-0.15.1-windows-x64.msi'
    ])
    const result = Bun.spawnSync({
      cmd: [
        'bun',
        'scripts/check-release-assets.ts',
        dir,
        'v0.15.1',
        '--require',
        'linux-x86_64:AppImage',
        '--require',
        'windows-x64:msi'
      ],
      cwd: repoRoot
    })
    expect(result.exitCode).toBe(0)
    expect(new TextDecoder().decode(result.stdout)).toContain('2 launcher-installable asset(s)')
  })

  test("fails on a bundle the workflow forgot to rename, and on a platform that didn't ship", async () => {
    const dir = await stagingWith(['Redrob.Design_0.15.1_aarch64.dmg'])
    const result = Bun.spawnSync({
      cmd: [
        'bun',
        'scripts/check-release-assets.ts',
        dir,
        '0.15.1',
        '--require',
        'macos-aarch64:dmg'
      ],
      cwd: repoRoot
    })
    expect(result.exitCode).not.toBe(0)
    const stderr = new TextDecoder().decode(result.stderr)
    expect(stderr).toContain('Redrob Launcher cannot read this name')
    expect(stderr).toContain('missing redrob-design-0.15.1-macos-aarch64.dmg')
  })

  test('fails on an empty directory rather than publishing nothing', async () => {
    const dir = await stagingWith([])
    const result = Bun.spawnSync({
      cmd: ['bun', 'scripts/check-release-assets.ts', dir, '0.15.1'],
      cwd: repoRoot
    })
    expect(result.exitCode).not.toBe(0)
  })
})

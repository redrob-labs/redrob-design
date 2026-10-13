import { describe, expect, test } from 'bun:test'

import {
  checkReleaseAssets,
  parseLauncherAssetName,
  parseRequirement,
  releaseAssetName
} from '../src/asset-names'

describe('releaseAssetName', () => {
  test('spells every platform the way the launcher reads it', () => {
    expect(releaseAssetName({ version: '0.15.1', token: 'macos-aarch64', suffix: '.dmg' })).toBe(
      'redrob-design-0.15.1-macos-aarch64.dmg'
    )
    expect(releaseAssetName({ version: 'v0.15.1', token: 'windows-x64', suffix: '.msi' })).toBe(
      'redrob-design-0.15.1-windows-x64.msi'
    )
    expect(
      releaseAssetName({ version: '0.15.1', token: 'linux-x86_64', suffix: '.AppImage' })
    ).toBe('redrob-design-0.15.1-linux-x86_64.AppImage')
    expect(
      releaseAssetName({ version: '0.15.1', token: 'windows-x64', suffix: '-setup.exe' })
    ).toBe('redrob-design-0.15.1-windows-x64-setup.exe')
  })

  test('refuses a version it cannot spell', () => {
    expect(() =>
      releaseAssetName({ version: 'latest', token: 'macos-aarch64', suffix: '.dmg' })
    ).toThrow(/Not a release version/)
  })
})

describe('parseLauncherAssetName', () => {
  test('reads what the workflow writes, round trip', () => {
    const parsed = parseLauncherAssetName('redrob-design-0.15.1-rc.1-windows-x64-portable.zip')
    expect(parsed).toEqual({
      stem: 'redrob-design',
      version: '0.15.1-rc.1',
      token: 'windows-x64',
      suffix: '-portable.zip'
    })
  })

  test("skips Tauri's own bundle names, which is why the workflow renames them", () => {
    expect(parseLauncherAssetName('Redrob.Design_0.15.0_aarch64.dmg')).toBeNull()
    expect(parseLauncherAssetName('Redrob.Design_x64.app.tar.gz')).toBeNull()
    expect(parseLauncherAssetName('redrob-design_0.15.0_amd64.deb')).toBeNull()
  })

  test('skips the spellings the launcher does not look for', () => {
    // Not x64 on Linux, not amd64, not arm64 on macOS, not "mac" or "win".
    expect(parseLauncherAssetName('redrob-design-0.15.1-linux-x64.AppImage')).toBeNull()
    expect(parseLauncherAssetName('redrob-design-0.15.1-linux-amd64.deb')).toBeNull()
    expect(parseLauncherAssetName('redrob-design-0.15.1-mac-aarch64.dmg')).toBeNull()
    expect(parseLauncherAssetName('redrob-design-0.15.1-win-x64.msi')).toBeNull()
    // A Windows setup exe is not something the launcher installs.
    expect(parseLauncherAssetName('redrob-design-0.15.1-windows-x64-setup.exe')).toBeNull()
    // And a leading v is not part of a version.
    expect(parseLauncherAssetName('redrob-design-v0.15.1-windows-x64.msi')).toBeNull()
  })
})

describe('checkReleaseAssets', () => {
  const requirements = [
    parseRequirement('macos-aarch64:dmg'),
    parseRequirement('macos-x86_64:dmg'),
    parseRequirement('windows-x64:msi'),
    parseRequirement('linux-x86_64:AppImage,deb,rpm')
  ]

  test('accepts a complete, correctly named release', () => {
    const result = checkReleaseAssets(
      [
        'redrob-design-0.15.1-linux-x86_64.AppImage',
        'redrob-design-0.15.1-linux-x86_64.deb',
        'redrob-design-0.15.1-linux-x86_64.rpm',
        'redrob-design-0.15.1-macos-aarch64.dmg',
        'redrob-design-0.15.1-macos-x86_64.dmg',
        'redrob-design-0.15.1-windows-x64-setup.exe',
        'redrob-design-0.15.1-windows-x64.msi',
        'redrob-launcher.json'
      ],
      'v0.15.1',
      requirements
    )
    expect(result.errors).toEqual([])
    expect(result.installable).toHaveLength(6)
    expect(result.companions).toEqual([
      'redrob-design-0.15.1-windows-x64-setup.exe',
      'redrob-launcher.json'
    ])
  })

  test('accepts the launcher manifest only under its exact name', () => {
    expect(checkReleaseAssets(['redrob-launcher.json'], '0.15.1', []).errors).toEqual([])
    expect(checkReleaseAssets(['redrob-launcher.JSON'], '0.15.1', []).errors).toHaveLength(1)
    expect(checkReleaseAssets(['redrob-launcher-0.15.1.json'], '0.15.1', []).errors).toHaveLength(1)
  })

  test('names every missing platform, not just the first', () => {
    const result = checkReleaseAssets(
      ['redrob-design-0.15.1-macos-aarch64.dmg'],
      '0.15.1',
      requirements
    )
    expect(result.errors).toEqual([
      'missing redrob-design-0.15.1-macos-x86_64.dmg',
      'missing redrob-design-0.15.1-windows-x64.msi',
      'missing redrob-design-0.15.1-linux-x86_64.AppImage',
      'missing redrob-design-0.15.1-linux-x86_64.deb',
      'missing redrob-design-0.15.1-linux-x86_64.rpm'
    ])
  })

  test('rejects an unrenamed Tauri bundle and a file from another version', () => {
    const result = checkReleaseAssets(
      ['Redrob.Design_0.15.1_aarch64.dmg', 'redrob-design-0.15.0-windows-x64.msi'],
      '0.15.1',
      []
    )
    expect(result.errors).toHaveLength(2)
    expect(result.errors[0]).toMatch(/Redrob Launcher cannot read this name/)
    expect(result.errors[1]).toMatch(/version 0.15.0 is not the release version 0.15.1/)
  })

  test('does not let a companion suffix smuggle an unreadable token through', () => {
    const result = checkReleaseAssets(['redrob-design-0.15.1-win-x64-setup.exe'], '0.15.1', [])
    expect(result.errors).toHaveLength(1)
    expect(result.companions).toEqual([])
  })
})

describe('parseRequirement', () => {
  test('reads the CLI spelling', () => {
    expect(parseRequirement('linux-x86_64:AppImage,.deb')).toEqual({
      token: 'linux-x86_64',
      suffixes: ['.AppImage', '.deb']
    })
  })

  test('refuses tokens and extensions the launcher does not know', () => {
    expect(() => parseRequirement('linux-x64:AppImage')).toThrow(
      /not a token Redrob Launcher looks for/
    )
    expect(() => parseRequirement('windows-x64:exe')).toThrow(
      /not an extension Redrob Launcher installs/
    )
  })
})

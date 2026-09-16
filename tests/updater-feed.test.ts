import { describe, expect, test } from 'bun:test'

import { DEFAULT_UPDATER_ENDPOINT, updaterOverlay } from '../scripts/tauri-updater-overlay'
import { updaterFeed } from '../scripts/build-updater-feed'

describe('updater config overlay', () => {
  test('stays absent when no public key is configured, which is how builds worked before', () => {
    // The committed tauri.conf.json must keep working for a contributor with no release keypair, and
    // the app already degrades cleanly: no plugins.updater section means updater_configured() is
    // false and the front end skips the check.
    expect(updaterOverlay({})).toBeNull()
    expect(updaterOverlay({ TAURI_SIGNING_PUBLIC_KEY: '   ' })).toBeNull()
  })

  test('refuses a signing key without a public key', () => {
    // Signed artefacts nothing can verify look like a working release until an update is attempted,
    // so half-configured secrets fail the build rather than shipping.
    expect(() => updaterOverlay({ TAURI_SIGNING_PRIVATE_KEY: 'private' })).toThrow(
      /TAURI_SIGNING_PRIVATE_KEY is set but TAURI_SIGNING_PUBLIC_KEY is not/,
    )
  })

  test('turns artefacts on and points at the feed', () => {
    const overlay = updaterOverlay({ TAURI_SIGNING_PUBLIC_KEY: 'pubkey-base64', TAURI_SIGNING_PRIVATE_KEY: 'private' })
    expect(overlay).toEqual({
      bundle: { createUpdaterArtifacts: true },
      plugins: { updater: { endpoints: [DEFAULT_UPDATER_ENDPOINT], pubkey: 'pubkey-base64' } },
    })
    // The default endpoint is the version-free alias, so a shipped build keeps resolving after the
    // next release moves it.
    expect(DEFAULT_UPDATER_ENDPOINT).toBe('https://cdn.redrob.ai/design/latest/latest.json')
  })

  test('takes an endpoint override, but only over https', () => {
    expect(
      updaterOverlay({ TAURI_SIGNING_PUBLIC_KEY: 'k', REDROB_UPDATER_ENDPOINT: 'https://example.test/feed.json' })?.plugins
        .updater.endpoints,
    ).toEqual(['https://example.test/feed.json'])
    expect(() =>
      updaterOverlay({ TAURI_SIGNING_PUBLIC_KEY: 'k', REDROB_UPDATER_ENDPOINT: 'http://insecure.test/feed.json' }),
    ).toThrow(/must be an https URL/)
  })
})

describe('updater feed', () => {
  const publishedAt = new Date('2026-09-16T00:00:00.000Z')
  const fragments = [
    { platform: 'darwin-aarch64', file: 'redrob-design-arm64-0.14.0.app.tar.gz', signature: 'sig-darwin-arm\n' },
    { platform: 'linux-x86_64', file: 'redrob-design-x64-0.14.0.AppImage', signature: 'sig-linux' },
  ]

  test('carries the published URL each job stated, not a name guessed from the bundler', () => {
    const { feed } = updaterFeed({
      fragments,
      version: 'v0.14.0',
      baseUrl: 'https://cdn.redrob.ai/design/latest/',
      publishedAt,
    })
    // Tauri's keys are <os>-<arch>, not the Rust target triples the build jobs use.
    expect(feed.platforms['darwin-aarch64']).toEqual({
      signature: 'sig-darwin-arm',
      url: 'https://cdn.redrob.ai/design/latest/redrob-design-arm64-0.14.0.app.tar.gz',
    })
    expect(feed.platforms['linux-x86_64']?.signature).toBe('sig-linux')
    // The leading v is dropped: the plugin compares against the app's own semver.
    expect(feed.version).toBe('0.14.0')
    expect(feed.pub_date).toBe('2026-09-16T00:00:00.000Z')
  })

  test('drops a fragment with no signature instead of advertising it', () => {
    // An entry without a signature hands the app an update it must reject, which is worse than that
    // platform having no update at all.
    const { feed, skipped } = updaterFeed({
      fragments: [...fragments, { platform: 'windows-x86_64', file: 'redrob-design-x64-0.14.0.nsis.zip', signature: '' }],
      version: '0.14.0',
      baseUrl: 'https://cdn.redrob.ai/design/latest',
      publishedAt,
    })
    expect(Object.keys(feed.platforms).sort()).toEqual(['darwin-aarch64', 'linux-x86_64'])
    expect(skipped).toEqual(['windows-x86_64'])
  })

  test('refuses a platform key the updater does not know', () => {
    // A typo here would publish a feed the plugin silently ignores on that platform.
    expect(() =>
      updaterFeed({
        fragments: [{ platform: 'linux-amd64', file: 'x.AppImage', signature: 'sig' }],
        version: '0.14.0',
        baseUrl: 'https://x.test',
        publishedAt,
      }),
    ).toThrow(/not a Tauri updater platform key/)
  })

  test('refuses to write a feed with no signed platform at all', () => {
    expect(() => updaterFeed({ fragments: [], version: '0.14.0', baseUrl: 'https://x.test', publishedAt })).toThrow(
      /no platform can install/,
    )
  })
})

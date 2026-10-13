import { describe, expect, test } from 'bun:test'

import {
  checkLauncherManifest,
  LAUNCHER_MANIFEST_NAME,
  launcherManifest,
  launcherManifestText
} from '../src/launcher-manifest'

describe('launcherManifestText', () => {
  test('is the exact line the launcher contract shows, newline-terminated', () => {
    expect(launcherManifestText()).toBe('{ "schema": 1, "sharedAccount": true }\n')
    expect(LAUNCHER_MANIFEST_NAME).toBe('redrob-launcher.json')
  })

  test('parses as valid JSON with schema 1 and sharedAccount true', () => {
    const parsed = JSON.parse(launcherManifestText()) as unknown
    expect(parsed).toEqual({ schema: 1, sharedAccount: true })
    expect(parsed).toEqual(launcherManifest())
  })

  test('passes its own check', () => {
    expect(checkLauncherManifest(launcherManifestText())).toEqual([])
  })
})

describe('checkLauncherManifest', () => {
  test('names an absent file', () => {
    expect(checkLauncherManifest(null)).toEqual([
      expect.stringMatching(/^missing redrob-launcher\.json/)
    ])
  })

  test('rejects text that is not a JSON object', () => {
    expect(checkLauncherManifest('{ schema: 1 }')).toEqual(['redrob-launcher.json: not valid JSON'])
    expect(checkLauncherManifest('[1]')).toEqual(['redrob-launcher.json: must be a JSON object'])
    expect(checkLauncherManifest('null')).toEqual(['redrob-launcher.json: must be a JSON object'])
  })

  test('rejects another schema and a sharedAccount that is not true, naming both', () => {
    expect(checkLauncherManifest('{ "schema": 2, "sharedAccount": false }')).toEqual([
      'redrob-launcher.json: schema must be 1, got 2',
      'redrob-launcher.json: sharedAccount must be true, got false'
    ])
    expect(checkLauncherManifest('{ "schema": "1", "sharedAccount": true }')).toEqual([
      'redrob-launcher.json: schema must be 1, got "1"'
    ])
    expect(checkLauncherManifest('{ "schema": 1 }')).toEqual([
      'redrob-launcher.json: sharedAccount must be true, got undefined'
    ])
  })

  test('ignores unknown fields, as the launcher does', () => {
    expect(
      checkLauncherManifest('{ "schema": 1, "sharedAccount": true, "later": "field" }')
    ).toEqual([])
  })
})

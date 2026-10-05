import { describe, expect, test } from 'bun:test'

import {
  DEFAULT_STORAGE_PROFILE,
  PUBLISH_STORAGE_PROFILE,
  migrateStoragePreferences,
  readStoragePreferences,
  storagePreferencesComplete,
  writeStoragePreference
} from '@/app/integrations/storage'
import { normalizePublicSiteURL } from '@/app/ship/publish/site'

describe('storage profile preferences', () => {
  test('move provider-keyed preferences into the default profile', () => {
    expect(
      migrateStoragePreferences(
        { 's3-compatible': { endpoint: 'https://s3.example.com', bucket: 'designs', bad: 3 } },
        null
      )
    ).toEqual({
      's3-compatible': {
        [DEFAULT_STORAGE_PROFILE]: { endpoint: 'https://s3.example.com', bucket: 'designs' }
      }
    })
  })

  test('keep profiles already stored over the legacy value', () => {
    expect(
      migrateStoragePreferences(
        { 's3-compatible': { bucket: 'old' } },
        {
          's3-compatible': {
            default: { bucket: 'new' },
            publish: { bucket: 'site' },
            unknown: { bucket: 'x' }
          }
        }
      )
    ).toEqual({ 's3-compatible': { default: { bucket: 'new' }, publish: { bucket: 'site' } } })
  })

  test('ignore malformed stored values', () => {
    expect(migrateStoragePreferences('nope', [1, 2])).toEqual({})
  })

  test('keep each profile apart', () => {
    writeStoragePreference('s3-compatible', 'bucket', ' designs ')
    writeStoragePreference('s3-compatible', 'bucket', 'site', PUBLISH_STORAGE_PROFILE)
    expect(readStoragePreferences('s3-compatible').bucket).toBe('designs')
    expect(readStoragePreferences('s3-compatible', PUBLISH_STORAGE_PROFILE).bucket).toBe('site')

    writeStoragePreference('s3-compatible', 'endpoint', 'https://s3.example.com')
    expect(storagePreferencesComplete('s3-compatible')).toBe(true)
    expect(storagePreferencesComplete('s3-compatible', PUBLISH_STORAGE_PROFILE)).toBe(false)
  })
})

describe('public site URL', () => {
  test('accepts https and trims the trailing slash', () => {
    expect(normalizePublicSiteURL(' https://site.example.com/pages/ ')).toEqual({
      ok: true,
      url: 'https://site.example.com/pages'
    })
  })

  test('allows http only on this computer', () => {
    expect(normalizePublicSiteURL('http://localhost:9000/site')).toEqual({
      ok: true,
      url: 'http://localhost:9000/site'
    })
    expect(normalizePublicSiteURL('http://site.example.com')).toEqual({
      ok: false,
      reason: 'not-https'
    })
  })

  test('rejects queries, fragments, credentials and non-URLs', () => {
    for (const value of [
      'https://site.example.com/?a=1',
      'https://site.example.com/#top',
      'https://me:pw@site.example.com',
      'site.example.com'
    ]) {
      expect(normalizePublicSiteURL(value).ok).toBe(false)
    }
    expect(normalizePublicSiteURL('   ')).toEqual({ ok: false, reason: 'empty' })
  })
})

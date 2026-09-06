import { describe, expect, test } from 'bun:test'

import {
  buildCORSConfigurationJSON,
  buildCORSConfigurationXML,
  collectCloudCORSOrigins,
  isLikelyCORSOrNetworkError
} from '@/app/integrations/storage/s3/cors'
import { WEB_APP_ORIGIN } from '@/constants'

describe('cloud S3 CORS helpers', () => {
  test('builds XML with required methods and wildcard headers', () => {
    const xml = buildCORSConfigurationXML(['https://app.redrobdesign.dev', 'http://localhost:1420'])
    expect(xml).toContain('<AllowedOrigin>https://app.redrobdesign.dev</AllowedOrigin>')
    expect(xml).toContain('<AllowedOrigin>http://localhost:1420</AllowedOrigin>')
    expect(xml).toContain('<AllowedMethod>GET</AllowedMethod>')
    expect(xml).toContain('<AllowedMethod>PUT</AllowedMethod>')
    expect(xml).toContain('<AllowedMethod>HEAD</AllowedMethod>')
    expect(xml).toContain('<AllowedMethod>DELETE</AllowedMethod>')
    expect(xml).toContain('<AllowedHeader>*</AllowedHeader>')
    expect(xml).toContain('<ExposeHeader>ETag</ExposeHeader>')
  })

  test('escapes XML special characters in origins', () => {
    const xml = buildCORSConfigurationXML(['https://example.com/a&b'])
    expect(xml).toContain('https://example.com/a&amp;b')
  })

  test('builds AWS console JSON', () => {
    const json = JSON.parse(buildCORSConfigurationJSON(['https://app.redrobdesign.dev'])) as Array<{
      AllowedOrigins: string[]
      AllowedMethods: string[]
      AllowedHeaders: string[]
    }>
    expect(json).toHaveLength(1)
    expect(json[0]?.AllowedOrigins).toContain('https://app.redrobdesign.dev')
    expect(json[0]?.AllowedMethods).toEqual(
      expect.arrayContaining(['GET', 'PUT', 'POST', 'DELETE', 'HEAD'])
    )
    expect(json[0]?.AllowedHeaders).toEqual(['*'])
  })

  test('collects static web and localhost origins', () => {
    const origins = collectCloudCORSOrigins()
    expect(origins).toContain(WEB_APP_ORIGIN)
    expect(origins).toContain('https://*.redrob.design')
    expect(origins).toContain('https://*.redrob-design.pages.dev')
    expect(origins).toContain('http://localhost:*')
    expect(origins).toContain('http://127.0.0.1:*')
  })

  test('detects typical browser CORS/network failures', () => {
    expect(isLikelyCORSOrNetworkError(new TypeError('Failed to fetch'))).toBe(true)
    expect(isLikelyCORSOrNetworkError(new Error('blocked by CORS policy'))).toBe(true)
    expect(isLikelyCORSOrNetworkError(new Error('Access key invalid'))).toBe(false)
  })
})

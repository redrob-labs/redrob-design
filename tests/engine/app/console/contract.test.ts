import { describe, expect, test } from 'bun:test'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { CONSOLE_ROUTES, consoleOpenAPI } from '@/app/integrations/console'

const OPENAPI_PATH = fileURLToPath(
  new URL('../../../../src/app/integrations/console/contract/openapi.json', import.meta.url)
)

interface OpenAPIOperation {
  responses: Record<string, unknown>
  security: unknown[]
}

interface OpenAPIDocument {
  paths: Record<string, Record<string, OpenAPIOperation>>
}

describe('Console contract', () => {
  test('openapi.json is generated from the schemas', () => {
    const generated = consoleOpenAPI()
    // UPDATE_CONSOLE_OPENAPI=1 bun test tests/engine/app/console/contract.test.ts rewrites it;
    // `bun run format` may reflow it, so the check compares content, not layout.
    if (process.env.UPDATE_CONSOLE_OPENAPI === '1') {
      writeFileSync(OPENAPI_PATH, `${JSON.stringify(generated, null, 2)}\n`)
    }
    expect(JSON.parse(readFileSync(OPENAPI_PATH, 'utf8'))).toEqual(generated)
  })

  test('every route has a unique operation and documents its failures', () => {
    const operations = CONSOLE_ROUTES.map((route) => route.operationId)
    expect(new Set(operations).size).toBe(operations.length)
    const document = consoleOpenAPI() as OpenAPIDocument
    for (const route of CONSOLE_ROUTES) {
      const operation = document.paths[route.path][route.method.toLowerCase()]
      expect(operation.responses).toHaveProperty('429')
      if (route.auth !== 'public') {
        expect(operation.responses).toHaveProperty('401')
        expect(operation.security).toEqual([{ bearer: [] }])
      } else {
        expect(operation.security).toEqual([])
      }
    }
  })
})

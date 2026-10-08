import { z } from 'zod'

import { CONSOLE_ROUTES, type ConsoleRoute } from './routes'
import { CONSOLE_ERROR_CODES, errorBodySchema } from './schemas'

type JSONSchema = Record<string, unknown>

function schemaOf(type: z.ZodType): JSONSchema {
  const { $schema: _, ...schema } = z.toJSONSchema(type, { target: 'openapi-3.0', io: 'output' })
  return schema
}

function pathParameters(path: string): JSONSchema[] {
  return [...path.matchAll(/\{(\w+)\}/g)].map((match) => ({
    name: match[1],
    in: 'path',
    required: true,
    schema: { type: 'string' }
  }))
}

const ERROR_RESPONSE = {
  description: 'A failure, as `{ "error": "<snake_case_code>" }`.',
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
}

const RETRY_AFTER = {
  description: 'Seconds to wait before retrying.',
  schema: { type: 'integer', minimum: 0 }
}

function operation(route: ConsoleRoute): JSONSchema {
  const parameters = [
    ...pathParameters(route.path),
    ...Object.entries(route.query ?? {}).map(([name, query]) => ({
      name,
      in: 'query',
      required: query.required ?? false,
      description: query.description,
      schema: { type: 'string' }
    })),
    ...(route.revisioned && route.method !== 'GET'
      ? [{ name: 'If-Match', in: 'header', required: false, schema: { type: 'string' } }]
      : []),
    ...(route.auth === 'bearer-or-link'
      ? [
          {
            name: 'X-Redrob-Link',
            in: 'header',
            required: false,
            description: 'A view link token, instead of the session. Grants viewer access.',
            schema: { type: 'string' }
          }
        ]
      : [])
  ]
  const status = String(route.status ?? 200)
  const success: JSONSchema = { description: route.summary }
  if (route.response) success.content = { 'application/json': { schema: schemaOf(route.response) } }
  if (route.revisioned) success.headers = { ETag: { schema: { type: 'string' } } }
  const responses: JSONSchema = {
    [status]: success,
    '400': ERROR_RESPONSE,
    '429': { ...ERROR_RESPONSE, headers: { 'Retry-After': RETRY_AFTER } },
    '503': { ...ERROR_RESPONSE, headers: { 'Retry-After': RETRY_AFTER } }
  }
  if (route.auth !== 'public') {
    responses['401'] = ERROR_RESPONSE
    responses['403'] = ERROR_RESPONSE
  }
  if (route.path.includes('{')) responses['404'] = ERROR_RESPONSE
  if (route.revisioned && route.method !== 'GET') {
    responses['409'] = ERROR_RESPONSE
    responses['412'] = ERROR_RESPONSE
  }
  const result: JSONSchema = {
    operationId: route.operationId,
    summary: route.summary,
    security: route.auth === 'public' ? [] : [{ bearer: [] }],
    responses
  }
  if (parameters.length > 0) result.parameters = parameters
  if (route.body) {
    result.requestBody = {
      required: true,
      content: { 'application/json': { schema: schemaOf(route.body) } }
    }
  }
  return result
}

/** The OpenAPI 3.1 description of every Console endpoint Redrob Design calls. */
export function consoleOpenAPI(): JSONSchema {
  const paths: Record<string, Record<string, JSONSchema>> = {}
  for (const route of CONSOLE_ROUTES) {
    paths[route.path] ??= {}
    paths[route.path][route.method.toLowerCase()] = operation(route)
  }
  return {
    openapi: '3.1.0',
    info: {
      title: 'Redrob Console API for Redrob Design',
      version: '1.0.0',
      description:
        'Generated from src/app/integrations/console/contract. JSON with camelCase fields, bearer auth, `{ error: code }` failures, Retry-After on 429 and 503, cursor pagination and ETag / If-Match on revisioned resources. Model provider keys never pass through these endpoints.'
    },
    servers: [{ url: 'https://console.redrob.ai/api/backend/v1' }],
    paths,
    components: {
      securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } },
      schemas: {
        Error: {
          ...schemaOf(errorBodySchema),
          description: `Known codes: ${CONSOLE_ERROR_CODES.join(', ')}.`
        }
      }
    }
  }
}

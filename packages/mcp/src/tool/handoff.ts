import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'

import { MAX_RESULT_BYTES } from '#mcp/result'

export type HandoffRPCSender = (body: Record<string, unknown>) => Promise<unknown>

/** One file of a hand-off, as the app sends it: text for text files, base64 for images. */
export interface HandoffWireFile {
  name: string
  mimeType: string
  text?: string
  base64?: string
}

export interface HandoffWire {
  documentId: string
  slug: string
  prompt: string
  files: HandoffWireFile[]
}

export const HANDOFF_URI_TEMPLATE = 'redrob://handoff/{document}/{file}'
export const HANDOFF_PROMPT_NAME = 'redrob_handoff'

const handoffFileSchema = z.object({
  name: z.string().min(1),
  mimeType: z.string().min(1),
  text: z.string().optional(),
  base64: z.string().optional()
})

const handoffSchema = z.object({
  documentId: z.string(),
  slug: z.string().min(1),
  prompt: z.string(),
  files: z.array(handoffFileSchema)
})

/** Asks the app for the latest hand-off of a document (or the active one) and checks its shape. */
export async function fetchHandoff(
  sendRPC: HandoffRPCSender,
  documentId: string | undefined
): Promise<HandoffWire> {
  const response = (await sendRPC({
    command: 'get_handoff',
    args: documentId ? { handoff_document: documentId } : {}
  })) as { ok?: boolean; result?: unknown; error?: string }
  if (response.ok === false) throw new Error(response.error ?? 'Redrob Design has no hand-off')
  const parsed = handoffSchema.safeParse(response.result)
  if (!parsed.success) throw new Error('Redrob Design returned an unreadable hand-off')
  return parsed.data
}

export function handoffURI(documentId: string, file: string): string {
  return `redrob://handoff/${encodeURIComponent(documentId)}/${encodeURIComponent(file)}`
}

/** The brief inline and every file as a resource link Claude Code can read. */
export function handoffSummary(handoff: HandoffWire): string {
  const brief = handoff.files.find((file) => file.name === 'brief.md')?.text ?? ''
  const files = handoff.files
    .map((file) => `- ${file.name}: ${handoffURI(handoff.documentId, file.name)}`)
    .join('\n')
  return [
    brief.trim(),
    '',
    '## Hand-off files',
    '',
    `Read these MCP resources, or write them to .redrob/handoff/${handoff.slug}/:`,
    files
  ].join('\n')
}

function readFile(handoff: HandoffWire, name: string, uri: URL): ReadResourceResult {
  const file = handoff.files.find((entry) => entry.name === name)
  if (!file) throw new Error(`No hand-off file named ${name}`)
  const size = (file.text ?? file.base64 ?? '').length
  if (size > MAX_RESULT_BYTES) throw new Error(`Hand-off file ${name} is too large to send`)
  if (file.base64 !== undefined) {
    return { contents: [{ uri: uri.href, mimeType: file.mimeType, blob: file.base64 }] }
  }
  return { contents: [{ uri: uri.href, mimeType: file.mimeType, text: file.text ?? '' }] }
}

function variable(value: string | string[] | undefined): string {
  return decodeURIComponent(Array.isArray(value) ? (value[0] ?? '') : (value ?? ''))
}

/**
 * Hand-off resources and the `redrob_handoff` prompt. The tool of the same
 * job, `get_handoff`, is registered with the other tools so policy applies.
 */
export function registerHandoffResources(mcpServer: McpServer, sendRPC: HandoffRPCSender): void {
  mcpServer.registerResource(
    'redrob-handoff',
    new ResourceTemplate(HANDOFF_URI_TEMPLATE, {
      list: async () => {
        try {
          const handoff = await fetchHandoff(sendRPC, undefined)
          return {
            resources: handoff.files.map((file) => ({
              uri: handoffURI(handoff.documentId, file.name),
              name: `${handoff.slug}/${file.name}`,
              mimeType: file.mimeType
            }))
          }
        } catch {
          return { resources: [] }
        }
      }
    }),
    {
      title: 'Redrob Design hand-off',
      description:
        'The page handed off from Redrob Design: brief.md, Page.jsx, tokens.json and preview.png.'
    },
    async (uri, variables) => {
      const handoff = await fetchHandoff(sendRPC, variable(variables.document) || undefined)
      return readFile(handoff, variable(variables.file), uri)
    }
  )

  mcpServer.registerPrompt(
    HANDOFF_PROMPT_NAME,
    {
      title: 'Implement the Redrob Design hand-off',
      description:
        'Loads the page handed off from Redrob Design (the brief and its files) and asks to implement it in this repository.',
      argsSchema: {
        document: z.string().describe('Optional Redrob Design document ID').optional()
      }
    },
    async ({ document }) => {
      const handoff = await fetchHandoff(sendRPC, document)
      return {
        description: `Hand-off: ${handoff.slug}`,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Implement this page from Redrob Design in this repository, using its existing components and conventions.\n\n${handoffSummary(handoff)}`
            }
          }
        ]
      }
    }
  )
}

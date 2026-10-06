import { describe, expect, test } from 'bun:test'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import { createMCPSessionManager } from '#mcp/server/sessions'
import { handoffURI, type HandoffWire } from '#mcp/tool/handoff'
import { registerTools } from '#mcp/tool/registration'

const HANDOFF: HandoffWire = {
  documentId: 'file:/work/app.fig',
  slug: 'pricing',
  prompt: 'claude "Implement .redrob/handoff/pricing/brief.md"',
  files: [
    { name: 'brief.md', mimeType: 'text/markdown', text: '# Pricing\n\n> A pricing page' },
    { name: 'Page.jsx', mimeType: 'text/javascript', text: 'export default function Page() {}' },
    { name: 'tokens.json', mimeType: 'application/json', text: '{}' },
    { name: 'preview.png', mimeType: 'image/png', base64: 'iVBORw0=' }
  ]
}

async function connect(
  answer: (body: Record<string, unknown>) => unknown,
  disabledTools: string[] = []
) {
  const calls: Array<Record<string, unknown>> = []
  const server = new McpServer({ name: 'redrob-design', version: 'test' })
  registerTools(server, {
    policy: { allowEval: false, disabledTools },
    sendRPC: (body) => {
      calls.push(body)
      return Promise.resolve(answer(body))
    }
  })
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  await server.connect(serverSide)
  const client = new Client({ name: 'test', version: '1' })
  await client.connect(clientSide)
  return { client, calls }
}

const ok = () => ({ ok: true, result: HANDOFF })

describe('MCP hand-off', () => {
  test('get_handoff returns the brief, resource links and the text files', async () => {
    const { client, calls } = await connect(ok)
    const result = await client.callTool({ name: 'get_handoff', arguments: {} })
    const content = result.content as Array<{ type: string; text: string }>
    expect(calls[0]).toEqual({ command: 'get_handoff', args: {} })
    expect(content[0].text).toContain('# Pricing')
    expect(content[0].text).toContain(handoffURI(HANDOFF.documentId, 'preview.png'))
    expect(content.some((part) => part.text.startsWith('--- Page.jsx ---'))).toBe(true)
    expect(content.some((part) => part.text.includes('preview.png ---'))).toBe(false)
  })

  test('asks for a named document when one is given', async () => {
    const { client, calls } = await connect(ok)
    await client.callTool({ name: 'get_handoff', arguments: { document: 'doc:1' } })
    expect(calls[0]).toEqual({ command: 'get_handoff', args: { handoff_document: 'doc:1' } })
  })

  test('reports when the app has nothing to hand off', async () => {
    const { client } = await connect(() => ({ ok: false, error: 'No hand-off for document x' }))
    const result = await client.callTool({ name: 'get_handoff', arguments: {} })
    expect(result.isError).toBe(true)
  })

  test('lists and reads every file as a resource, text or blob', async () => {
    const { client } = await connect(ok)
    const listed = await client.listResources()
    expect(listed.resources.map((resource) => resource.name)).toEqual([
      'pricing/brief.md',
      'pricing/Page.jsx',
      'pricing/tokens.json',
      'pricing/preview.png'
    ])
    const brief = await client.readResource({ uri: handoffURI(HANDOFF.documentId, 'brief.md') })
    expect(brief.contents[0]).toMatchObject({
      mimeType: 'text/markdown',
      text: HANDOFF.files[0].text
    })
    const preview = await client.readResource({
      uri: handoffURI(HANDOFF.documentId, 'preview.png')
    })
    expect(preview.contents[0]).toMatchObject({ mimeType: 'image/png', blob: 'iVBORw0=' })
  })

  test('the redrob_handoff prompt asks to implement the page with its files', async () => {
    const { client } = await connect(ok)
    const prompts = await client.listPrompts()
    expect(prompts.prompts.map((prompt) => prompt.name)).toContain('redrob_handoff')
    const prompt = await client.getPrompt({ name: 'redrob_handoff', arguments: {} })
    const message = prompt.messages[0].content as { type: string; text: string }
    expect(message.text).toContain('Implement this page from Redrob Design')
    expect(message.text).toContain('# Pricing')
  })

  test('disabling get_handoff also hides its resources and prompt', async () => {
    const { client } = await connect(ok, ['get_handoff'])
    const tools = await client.listTools()
    expect(tools.tools.map((tool) => tool.name)).not.toContain('get_handoff')
    await expect(client.listPrompts()).rejects.toThrow()
  })
})

describe('MCP client sessions', () => {
  test('are counted so the app can tell an agent is connected', async () => {
    const sessions = createMCPSessionManager({
      serverVersion: 'test',
      registerTools: () => undefined
    })
    expect(sessions.count()).toBe(0)
    const transport = await sessions.resolveTransport(undefined)
    expect('error' in transport).toBe(false)
    expect(sessions.count()).toBe(1)
    await sessions.clear()
  })
})

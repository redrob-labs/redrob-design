/**
 * Webview half of the Redrob Code app bridge.
 *
 * The Rust host (`desktop/src/app_bridge.rs`) serves the app's tools to the
 * shared Redrob Code daemon and forwards every call here as an
 * `app-bridge:call` event `{ id, tool, args }`. This module runs the call
 * against the live editor through the same code paths the UI and the local
 * automation server use, then answers with `app_bridge_reply(id, ok, text)`.
 * Tauri only: in the browser there is no host to talk to.
 */
import type { ExportRequest } from '@redrob-design/core/io'
import { BUILTIN_IO_FORMATS, IORegistry } from '@redrob-design/core/io'
import type { SceneNode } from '@redrob-design/scene-graph'

import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import { ensureTauriParentDirectory } from '@/app/automation/bridge/file-handlers'
import { createAutomationCommandHandlers } from '@/app/automation/bridge/handlers'
import {
  getExportBaseName,
  getExportBytes,
  getExportFileName,
  getExportOptions,
  writeTauriExportFile
} from '@/app/document/export/files'
import type { EditorStore } from '@/app/editor/active-store'
import { activeTab, getActiveStore } from '@/app/tabs'
import { isTauri } from '@/app/tauri/env'

const CALL_EVENT = 'app-bridge:call'
const DEFAULT_LIST_MAX = 200

type UnknownRecord = Record<string, unknown>

interface BridgeCall {
  id: string
  tool: string
  args: unknown
}

type ToolHandler = (store: EditorStore, args: UnknownRecord) => Promise<string> | string

const io = new IORegistry(BUILTIN_IO_FORMATS)
const { handleRequest: runAutomation } = createAutomationCommandHandlers(makeFigmaFromStore)
const noop = () => undefined

function readRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {}
}

function requireString(args: UnknownRecord, key: string): string {
  const value = args[key]
  if (typeof value !== 'string' || value.length === 0) throw new Error(`"${key}" is required`)
  return value
}

function requireNumber(args: UnknownRecord, key: string): number {
  const value = args[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`"${key}" must be a number`)
  }
  return value
}

function requireNode(store: EditorStore, id: string): SceneNode {
  const node = store.graph.getNode(id)
  if (!node) throw new Error(`Layer "${id}" not found`)
  return node
}

function documentStore(): EditorStore {
  if (activeTab.value?.kind === 'home') throw new Error('No document is open')
  return getActiveStore()
}

/** Run one of the editor's built-in automation tools (the local MCP server's path). */
async function runEditorTool(
  store: EditorStore,
  name: string,
  args: UnknownRecord
): Promise<UnknownRecord> {
  const response = readRecord(await runAutomation(store, 'tool', { name, args }))
  const result = readRecord(response.result)
  if (typeof result.error === 'string') throw new Error(result.error)
  return result
}

function pageBounds(store: EditorStore, pageId: string): string {
  const children = store.graph.getChildren(pageId)
  if (children.length === 0) return 'empty canvas'
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const node of children) {
    minX = Math.min(minX, node.x)
    minY = Math.min(minY, node.y)
    maxX = Math.max(maxX, node.x + node.width)
    maxY = Math.max(maxY, node.y + node.height)
  }
  const size = `${Math.round(maxX - minX)}x${Math.round(maxY - minY)}`
  return `${size} at (${Math.round(minX)}, ${Math.round(minY)})`
}

function selectionSummary(store: EditorStore): string {
  const ids = [...store.state.selectedIds]
  if (ids.length === 0) return 'nothing selected'
  const names = ids
    .slice(0, 5)
    .map((id) => store.graph.getNode(id))
    .filter((node): node is SceneNode => node !== undefined)
    .map((node) => `${node.name} (${node.type}, ${node.id})`)
  const more = ids.length > names.length ? `, +${ids.length - names.length} more` : ''
  return `${ids.length} selected: ${names.join(', ')}${more}`
}

const handlers: Record<string, ToolHandler> = {
  document_info(store) {
    const pageId = store.state.currentPageId
    const page = store.graph.getNode(pageId)
    const pages = store.graph.getPages()
    const path = store.getDocumentFilePath()
    return [
      `document: ${store.state.documentName}`,
      `file: ${path ?? 'untitled (not saved to disk)'}`,
      `pages: ${pages.length}, current: ${page?.name ?? pageId} (${pageId})`,
      `top-level layers on current page: ${store.graph.getChildren(pageId).length}`,
      `canvas: ${pageBounds(store, pageId)}`,
      `selection: ${selectionSummary(store)}`
    ].join('\n')
  },

  list_layers(store, args) {
    const max =
      typeof args.max === 'number' && args.max >= 1 ? Math.floor(args.max) : DEFAULT_LIST_MAX
    const lines: string[] = []
    let total = 0
    const walk = (id: string, depth: number) => {
      for (const node of store.graph.getChildren(id)) {
        total++
        if (lines.length < max) {
          const flags = `${node.visible ? 'visible' : 'hidden'}${node.locked ? ', locked' : ''}`
          const indent = '  '.repeat(depth)
          lines.push(`${indent}${node.id}  ${node.type}  "${node.name}"  [${flags}]`)
        }
        walk(node.id, depth + 1)
      }
    }
    walk(store.state.currentPageId, 0)
    if (total === 0) return 'The current page has no layers.'
    if (total > lines.length)
      lines.push(`... ${total - lines.length} more (raise "max" to see them)`)
    return lines.join('\n')
  },

  select(store, args) {
    const ids = Array.isArray(args.ids)
      ? args.ids.filter((id): id is string => typeof id === 'string')
      : null
    if (!ids) throw new Error('"ids" must be an array of layer ids')
    for (const id of ids) requireNode(store, id)
    store.select(ids)
    store.requestRender()
    return `selected ${ids.length} layer${ids.length === 1 ? '' : 's'}`
  },

  async set_text(store, args) {
    const id = requireString(args, 'id')
    const text = typeof args.text === 'string' ? args.text : null
    if (text === null) throw new Error('"text" is required')
    const node = requireNode(store, id)
    if (node.type !== 'TEXT') throw new Error(`Layer "${id}" is a ${node.type}, not a text layer`)
    await runEditorTool(store, 'set_text', { id, text })
    return `set text of "${node.name}" (${id}) to ${JSON.stringify(text)}`
  },

  async set_visible(store, args) {
    const id = requireString(args, 'id')
    if (typeof args.visible !== 'boolean') throw new Error('"visible" must be true or false')
    const node = requireNode(store, id)
    await runEditorTool(store, 'set_visible', { id, value: args.visible })
    return `"${node.name}" (${id}) is now ${args.visible ? 'visible' : 'hidden'}`
  },

  async move_layer(store, args) {
    const id = requireString(args, 'id')
    const dx = requireNumber(args, 'dx')
    const dy = requireNumber(args, 'dy')
    const node = requireNode(store, id)
    if (node.locked) throw new Error(`Layer "${node.name}" (${id}) is locked`)
    const x = node.x + dx
    const y = node.y + dy
    await runEditorTool(store, 'update_node', { id, x, y })
    return `moved "${node.name}" (${id}) to (${Math.round(x)}, ${Math.round(y)})`
  },

  async export(store, args) {
    const format = requireString(args, 'format').toLowerCase()
    if (format !== 'png' && format !== 'svg' && format !== 'pdf') {
      throw new Error('"format" must be png, svg or pdf')
    }
    const scale =
      typeof args.scale === 'number' && args.scale > 0 ? Math.min(args.scale, 4) : undefined
    const ids = [...store.state.selectedIds]
    const target: ExportRequest['target'] =
      ids.length > 0
        ? { scope: 'selection', nodeIds: ids }
        : { scope: 'page', pageId: store.state.currentPageId }
    if (store.graph.getChildren(store.state.currentPageId).length === 0) {
      throw new Error('The current page has nothing to export')
    }

    const renderer = store.renderer
    const result = await io.exportContent(
      format,
      { graph: store.graph, target },
      getExportOptions(format, { scale }),
      renderer ? { canvasKit: renderer.ck, renderer } : undefined
    )
    const fileName = getExportFileName(
      getExportBaseName(store.graph, target),
      format,
      result.extension,
      { scale }
    )

    let path = typeof args.path === 'string' && args.path.length > 0 ? args.path : null
    if (!path) {
      const { downloadDir, join } = await import('@tauri-apps/api/path')
      path = await join(await downloadDir(), fileName)
    }
    await ensureTauriParentDirectory(path)
    await writeTauriExportFile(path, getExportBytes(result.data))
    return path
  },

  async save(store) {
    const path = store.getDocumentFilePath()
    if (!path) {
      throw new Error(
        'The document is untitled: ask the user to choose a location with File > Save As in the app'
      )
    }
    await store.saveFigFile()
    return `saved ${path}`
  }
}

async function reply(id: string, ok: boolean, text: string): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('app_bridge_reply', { id, ok, text })
}

async function handleCall(call: BridgeCall): Promise<void> {
  const handler = (handlers as Partial<Record<string, ToolHandler>>)[call.tool]
  try {
    if (!handler) throw new Error(`Unknown tool: ${call.tool}`)
    const text = await handler(documentStore(), readRecord(call.args))
    await reply(call.id, true, text)
  } catch (error) {
    await reply(call.id, false, error instanceof Error ? error.message : String(error))
  }
}

/**
 * Listen for the host's tool calls. Returns the unlisten function; a no-op
 * outside Tauri.
 */
export async function startAppBridgeHost(): Promise<() => void> {
  if (!isTauri()) return noop
  const { listen } = await import('@tauri-apps/api/event')
  return listen<BridgeCall>(CALL_EVENT, (event) => {
    void handleCall(event.payload)
  })
}

import { valibotSchema } from '@ai-sdk/valibot'
import { tool } from 'ai'
import * as v from 'valibot'

import {
  CORE_TOOLS,
  EXTENDED_TOOLS,
  registerComponentCatalog,
  toolsToAI
} from '@redrob-design/core/tools'
import type { StepBudget, ToolLogEntry } from '@redrob-design/core/tools'

import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import { assertCanEdit } from '@/app/cloud/files/permissions'
import { getActiveEditorStore } from '@/app/editor/active-store'
import type { EditorStore } from '@/app/editor/active-store'
import { ensureGraphFonts } from '@/app/editor/fonts'
import { useLibraryService } from '@/app/libraries'

export const MAX_AGENT_STEPS = 50

class RunState {
  toolLog: ToolLogEntry[] = []
  currentSteps = 0

  resetSteps(): void {
    this.currentSteps = 0
  }

  hitLimit(): boolean {
    return this.currentSteps >= MAX_AGENT_STEPS
  }

  clear(): void {
    this.toolLog = []
    this.currentSteps = 0
  }
}

const runStates = new WeakMap<EditorStore, RunState>()

function getRunState(store?: EditorStore): RunState {
  const target = store ?? getActiveEditorStore()
  const existing = runStates.get(target)
  if (existing) return existing
  const created = new RunState()
  runStates.set(target, created)
  return created
}

export function getToolLogEntries(store?: EditorStore): ToolLogEntry[] {
  return getRunState(store).toolLog
}

export function recordStep(store?: EditorStore): void {
  getRunState(store).currentSteps++
}

export function resetRunSteps(store?: EditorStore): void {
  getRunState(store).resetSteps()
}

export function didHitStepLimit(store?: EditorStore): boolean {
  return getRunState(store).hitLimit()
}

export function clearToolLogEntries(store?: EditorStore): void {
  getRunState(store).clear()
}

export function createAITools(store: EditorStore) {
  const runState = getRunState(store)
  const libraryService = useLibraryService()
  libraryService.bindEditor(store)
  registerComponentCatalog(store.graph, libraryService)

  return toolsToAI(
    [
      ...CORE_TOOLS,
      ...EXTENDED_TOOLS.filter((def) =>
        ['get_components', 'list_libraries', 'insert_library_component'].includes(def.name)
      )
    ],
    {
      getFigma: () => makeFigmaFromStore(store),
      executeTool: async (def, figma, args) => {
        // A shared file opened read-only: Redrob explains instead of changing what nobody saves.
        if (def.mutates) assertCanEdit(store)
        return def.mutates
          ? store.runMutationWithLayout(
              () => def.execute(figma, args),
              figma.currentPageId,
              async () => {
                const pageNode = store.graph.getNode(figma.currentPageId)
                if (pageNode) await ensureGraphFonts(store.graph, pageNode.childIds, store.renderer)
              }
            )
          : def.execute(figma, args)
      },
      // Undo is one step per answer, recorded when the turn finishes
      // (`finishChangeTurn`), not one per tool call.
      onAfterExecute: (def) => {
        if (def.mutates) store.requestRender()
      },
      onFlashNodes: (nodeIds) => {
        store.renderer?.aiClearActive()
        if (nodeIds.length > 0) {
          store.aiFlashDone(nodeIds)
        }
      },
      onToolLog: (entry) => {
        runState.toolLog.push(entry)
      },
      getStepBudget: (): StepBudget => ({
        current: runState.currentSteps,
        max: MAX_AGENT_STEPS
      })
    },
    { v, valibotSchema, tool }
  )
}

export type AITools = ReturnType<typeof createAITools>

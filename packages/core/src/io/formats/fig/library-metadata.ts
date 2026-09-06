import {
  ENABLED_LIBRARIES_PLUGIN_KEY,
  mergePluginData,
  REDROB_DESIGN_PLUGIN_ID
} from '@redrob-design/fig/node-change'
import type { KiwiNodeChange } from '@redrob-design/fig/node-change'
import type { SceneGraph } from '@redrob-design/scene-graph'

export function applyEnabledLibrariesPluginData(
  documentNodeChange: KiwiNodeChange,
  graph: SceneGraph
): void {
  const rootPluginData = graph.getNode(graph.rootId)?.pluginData ?? []
  const bindings = [...graph.enabledLibraries.values()]
  const managedBinding = rootPluginData.find(
    (entry) =>
      entry.pluginId === REDROB_DESIGN_PLUGIN_ID && entry.key === ENABLED_LIBRARIES_PLUGIN_KEY
  )
  const bindingEntry =
    bindings.length > 0
      ? {
          pluginId: REDROB_DESIGN_PLUGIN_ID,
          key: ENABLED_LIBRARIES_PLUGIN_KEY,
          value: JSON.stringify(bindings)
        }
      : managedBinding
  documentNodeChange.pluginData = mergePluginData([
    ...rootPluginData.filter(
      (entry) =>
        !(entry.pluginId === REDROB_DESIGN_PLUGIN_ID && entry.key === ENABLED_LIBRARIES_PLUGIN_KEY)
    ),
    ...(bindingEntry ? [bindingEntry] : [])
  ])
}

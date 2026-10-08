<script setup lang="ts">
import { tv } from 'tailwind-variants'

import { askRedrob } from '@/app/ai/chat/ask'
import toolbarTheme from '@/theme/toolbar'
import Tip from '@/components/ui/Tip.vue'
import ToolButton from '@/components/Toolbar/ToolButton.vue'
import ToolFlyout from '@/components/Toolbar/ToolFlyout.vue'
import {
  getToolbarToolSelection,
  isToolbarToolActive,
  toolbarToolTestId,
  ToolbarItem,
  formatShortcut,
  useI18n
} from '@redrob-design/vue'

import type { Tool } from '@redrob-design/vue'
import type { EditorToolDef } from '@redrob-design/core/editor'
import type { ToolbarUI, ToolIconMap, ToolLabels } from '@/components/Toolbar/types'

const { tools, activeTool, flyoutSelections, toolIcons, toolLabels, toolShortcuts, ui } =
  defineProps<{
    tools: EditorToolDef[]
    activeTool: Tool
    flyoutSelections: ReadonlyMap<Tool, Tool>
    toolIcons: ToolIconMap
    toolLabels: ToolLabels
    toolShortcuts: Record<Tool, string>
    ui?: ToolbarUI
  }>()

const { panels } = useI18n()
const styles = tv(toolbarTheme)()
const askShortcut = formatShortcut('MOD+J')

const emit = defineEmits<{
  setTool: [tool: Tool]
}>()
</script>

<template>
  <div class="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 items-center">
    <div
      data-test-id="toolbar"
      class="flex items-center gap-0.5 rounded-xl border border-border bg-panel p-1.5 shadow-md"
    >
      <template v-for="tool in tools" :key="tool.key">
        <Tip
          v-if="tool.flyout && tool.flyout.length > 1"
          :label="`${toolLabels[getToolbarToolSelection(tool, activeTool, flyoutSelections)]} (${tool.shortcut})`"
        >
          <ToolFlyout
            :tool="tool"
            :active-tool="activeTool"
            :selected-tool="getToolbarToolSelection(tool, activeTool, flyoutSelections)"
            :tool-icons="toolIcons"
            :tool-labels="toolLabels"
            :tool-shortcuts="toolShortcuts"
            :ui="ui"
            @select="emit('setTool', $event)"
          />
        </Tip>

        <ToolbarItem v-else v-slot="{ active, actions }" :tool="tool.key">
          <Tip :label="`${toolLabels[tool.key]} (${tool.shortcut})`">
            <ToolButton
              :data-test-id="toolbarToolTestId(tool.key)"
              :icon="toolIcons[tool.key]"
              :label="toolLabels[tool.key]"
              :active="active || isToolbarToolActive(tool, activeTool)"
              :ui="ui"
              @click="actions.select"
            />
          </Tip>
        </ToolbarItem>
      </template>
      <span :class="styles.separator()" aria-hidden="true" />
      <Tip :label="`${panels.askRedrob} (${askShortcut})`">
        <button
          type="button"
          data-test-id="toolbar-ask-redrob"
          :class="styles.ask()"
          @click="askRedrob"
        >
          <icon-lucide-sparkles :class="styles.askIcon()" />
          {{ panels.askRedrob }}
        </button>
      </Tip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { ToggleGroupItem, ToggleGroupRoot } from 'reka-ui'

import { useThreadMessages } from '@redrob-design/vue'

import { activeTab, activeTabMode, setTabMode } from '@/app/tabs'
import Tip from '@/components/ui/Tip.vue'
import theme from '@/theme/agent/controls'

/** Describe or Edit for the open file, in the tab bar. The same switch in both modes. */
const t = useThreadMessages()
const styles = tv(theme)()

function select(value: unknown): void {
  const tab = activeTab.value
  if (!tab || (value !== 'describe' && value !== 'edit')) return
  setTabMode(tab.id, value)
}
</script>

<template>
  <ToggleGroupRoot
    type="single"
    :model-value="activeTabMode"
    :aria-label="t.modeLabel"
    data-test-id="mode-switch"
    :class="styles.mode()"
    @update:model-value="select"
  >
    <Tip :label="t.modeDescribeHint">
      <ToggleGroupItem value="describe" :class="styles.modeItem()">
        <icon-lucide-message-square-text :class="styles.modeIcon()" />
        <span>{{ t.modeDescribe }}</span>
      </ToggleGroupItem>
    </Tip>
    <Tip :label="t.modeEditHint">
      <ToggleGroupItem value="edit" :class="styles.modeItem()">
        <icon-lucide-pen-tool :class="styles.modeIcon()" />
        <span>{{ t.modeEdit }}</span>
      </ToggleGroupItem>
    </Tip>
  </ToggleGroupRoot>
</template>

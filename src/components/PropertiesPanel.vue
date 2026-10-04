<script setup lang="ts">
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { tv } from 'tailwind-variants'

import { useI18n } from '@redrob-design/vue'
import { useAIChat } from '@/app/ai/chat/use'
import propertiesTabsTheme from '@/theme/properties-tabs'

import ChatPanel from './ChatPanel.vue'
import CodePanel from './CodePanel.vue'
import DesignPanel from './DesignPanel.vue'
import ZoomDropdown from './editor/ZoomDropdown.vue'

const { activeTab } = useAIChat()
const { panels } = useI18n()
const styles = tv(propertiesTabsTheme)()
</script>

<template>
  <aside
    data-test-id="properties-panel"
    class="flex min-w-0 flex-1 flex-col overflow-hidden border-l border-border bg-panel"
    style="contain: paint layout style"
  >
    <TabsRoot v-model="activeTab" class="flex min-h-0 flex-1 flex-col">
      <TabsList :class="styles.list()">
        <TabsTrigger value="design" data-test-id="properties-tab-design" :class="styles.trigger()">
          {{ panels.design }}
        </TabsTrigger>
        <TabsTrigger value="code" data-test-id="properties-tab-code" :class="styles.trigger()">
          <icon-lucide-code :class="styles.icon()" />
          {{ panels.code }}
        </TabsTrigger>
        <TabsTrigger value="ai" data-test-id="properties-tab-ai" :class="styles.trigger()">
          <icon-lucide-sparkles :class="styles.icon()" />
          {{ panels.ai }}
        </TabsTrigger>
        <ZoomDropdown v-if="activeTab === 'design'" />
      </TabsList>

      <TabsContent
        value="design"
        class="flex min-h-0 flex-1 flex-col"
        :force-mount="true"
        :hidden="activeTab !== 'design'"
      >
        <DesignPanel />
      </TabsContent>

      <TabsContent
        value="code"
        class="flex min-h-0 flex-1 flex-col"
        :force-mount="true"
        :hidden="activeTab !== 'code'"
      >
        <CodePanel :active="activeTab === 'code'" />
      </TabsContent>

      <TabsContent
        value="ai"
        class="flex min-h-0 flex-1 flex-col"
        :force-mount="true"
        :hidden="activeTab !== 'ai'"
      >
        <ChatPanel />
      </TabsContent>
    </TabsRoot>
  </aside>
</template>

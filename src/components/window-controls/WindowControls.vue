<script setup lang="ts">
import { tv } from 'tailwind-variants'

import { useI18n } from '@redrob-design/vue'

import Tip from '@/components/ui/Tip.vue'
import windowControlsTheme from '@/theme/window-controls'
import { useDesktopWindow } from '@/app/tauri/window'

const { menu } = useI18n()
const { frameless, maximized, minimize, toggleMaximize, close } = useDesktopWindow()
const styles = tv(windowControlsTheme)()
</script>

<!--
  Minimise, maximise or restore, and close, at the end of the tab bar when the
  desktop window has no OS title bar (Windows and Linux). Renders nothing in
  the browser and on macOS, which keeps its traffic lights.
-->
<template>
  <div v-if="frameless" data-test-id="window-controls" :class="styles.root()">
    <Tip :label="menu.minimizeWindow" side="bottom">
      <button :class="styles.button()" :aria-label="menu.minimizeWindow" @click="minimize">
        <icon-lucide-minus :class="styles.icon()" />
      </button>
    </Tip>
    <Tip :label="maximized ? menu.restoreWindow : menu.maximizeWindow" side="bottom">
      <button
        :class="styles.button()"
        :aria-label="maximized ? menu.restoreWindow : menu.maximizeWindow"
        @click="toggleMaximize"
      >
        <icon-lucide-copy v-if="maximized" :class="styles.icon()" />
        <icon-lucide-square v-else :class="styles.icon()" />
      </button>
    </Tip>
    <Tip :label="menu.closeWindow" side="bottom">
      <button :class="styles.close()" :aria-label="menu.closeWindow" @click="close">
        <icon-lucide-x :class="styles.icon()" />
      </button>
    </Tip>
  </div>
</template>

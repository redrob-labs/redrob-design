import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import Icons from 'unplugin-icons/vite'
import Components from 'unplugin-vue-components/vite'
import IconsResolver from 'unplugin-icons/resolver'
import { defineConfig } from 'vite'

// UI-only slice. No Tauri, no PWA, no backend — just the Vue presentation layer.
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    // Auto-import <icon-lucide-*> components used throughout the templates.
    Components({
      dts: 'src/components.d.ts',
      resolvers: [IconsResolver({ prefix: 'icon' })]
    }),
    Icons({ compiler: 'vue3' })
  ],
  resolve: {
    // Array form so matching is ordered, top-down. The specific stub aliases use
    // anchored regexes (exact module id) and MUST come before the generic `@/`
    // prefix, otherwise `@/…` would rewrite them to a non-existent src/app path.
    alias: [
      // Shared-foundation packages are satisfied by local stubs in this slice.
      {
        find: '@redrob-design/vue',
        replacement: fileURLToPath(new URL('./src/stubs/i18n.ts', import.meta.url))
      },
      {
        find: '@redrob-design/core/constants',
        replacement: fileURLToPath(new URL('./src/stubs/core-constants.ts', import.meta.url))
      },
      {
        find: '@redrob-labs/route-labeller',
        replacement: fileURLToPath(new URL('./src/stubs/route-labeller.ts', import.meta.url))
      },
      // Backend/native seams mapped to documented stubs (exact module ids).
      {
        find: /^@\/app\/tauri\/window$/,
        replacement: fileURLToPath(new URL('./src/stubs/tauri-window.ts', import.meta.url))
      },
      {
        find: /^@\/app\/ai\/insights$/,
        replacement: fileURLToPath(new URL('./src/stubs/ai-insights.ts', import.meta.url))
      },
      {
        find: /^@\/app\/ai\/model-guide$/,
        replacement: fileURLToPath(new URL('./src/stubs/ai-model-guide.ts', import.meta.url))
      },
      {
        find: /^@\/app\/tabs$/,
        replacement: fileURLToPath(new URL('./src/stubs/tabs.ts', import.meta.url))
      },
      {
        find: /^@\/app\/shell\/command-palette$/,
        replacement: fileURLToPath(new URL('./src/stubs/shell-command-palette.ts', import.meta.url))
      },
      {
        find: /^@\/app\/shell\/menu\/entry$/,
        replacement: fileURLToPath(new URL('./src/stubs/shell-menu-entry.ts', import.meta.url))
      },
      {
        find: /^@\/app\/shell\/menu\/main-menu$/,
        replacement: fileURLToPath(new URL('./src/stubs/shell-main-menu.ts', import.meta.url))
      },
      // Generic project alias — last, so the exact seams above win.
      { find: /^@\//, replacement: fileURLToPath(new URL('./src/', import.meta.url)) }
    ]
  }
})

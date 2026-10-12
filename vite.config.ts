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
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Shared-foundation packages are satisfied by local stubs in this slice.
      '@redrob-design/vue': fileURLToPath(new URL('./src/stubs/i18n.ts', import.meta.url)),
      '@redrob-design/core/constants': fileURLToPath(
        new URL('./src/stubs/core-constants.ts', import.meta.url)
      ),
      '@redrob-labs/route-labeller': fileURLToPath(
        new URL('./src/stubs/route-labeller.ts', import.meta.url)
      ),
      // Backend/native seams mapped to documented stubs.
      '@/app/tauri/window': fileURLToPath(new URL('./src/stubs/tauri-window.ts', import.meta.url)),
      '@/app/ai/insights': fileURLToPath(new URL('./src/stubs/ai-insights.ts', import.meta.url))
    }
  }
})

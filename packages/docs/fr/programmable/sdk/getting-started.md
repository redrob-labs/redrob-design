---
title: Premiers pas avec le SDK
description: Connectez @redrob-design/vue, créez un éditeur et configurez la zone de travail.
---

# Premiers pas avec le SDK

## Installation

```bash
bun add @redrob-design/core @redrob-design/vue canvaskit-wasm
```

Le SDK se trouve dans le monorepo Redrob Design et est publié sous forme de package `@redrob-design/vue`.

```ts
import { createEditor } from '@redrob-design/core/editor'
import { provideEditor, useCanvas } from '@redrob-design/vue'
```

## Couches de l'application

Une application basée sur le SDK se compose de trois couches :

1. `@redrob-design/core` — le moteur de l'éditeur, indépendant du framework ;
2. `@redrob-design/vue` — les composables et composants sans styles pour Vue ;
3. l'application — la présentation, le routage, la gestion des fichiers et l'interface propre au produit.

## Configuration minimale

### 1. Créez un éditeur

```ts
import { createEditor } from '@redrob-design/core/editor'

const editor = createEditor({
  width: 1200,
  height: 800,
})
```

### 2. Rendez l'éditeur accessible aux composants descendants

```vue
<script setup lang="ts">
import { provideEditor } from '@redrob-design/vue'

import type { Editor } from '@redrob-design/core/editor'

const props = defineProps<{
  editor: Editor
}>()

provideEditor(props.editor)
</script>

<template>
  <slot />
</template>
```

`provideEditor()` rend l'instance de l'éditeur accessible à tous les composants situés plus bas dans l'arbre. La documentation appelle directement cette fonction, car elle fait partie de l'API publique actuelle.

### 3. Connectez la zone de travail

```vue
<script setup lang="ts">
import { ref } from 'vue'

import { useCanvas, useEditor } from '@redrob-design/vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const editor = useEditor()

useCanvas(canvasRef, editor)
</script>

<template>
  <canvas ref="canvasRef" class="size-full" />
</template>
```

## Utiliser les composables

Après l'appel à `provideEditor()`, les composants descendants peuvent consulter la sélection et exécuter des commandes de l'éditeur :

```ts
import { useEditorCommands, useSelectionState } from '@redrob-design/vue'

const selection = useSelectionState()
const commands = useEditorCommands()
```

## Exemple simple

```vue
<script setup lang="ts">
import { ref } from 'vue'

import { useCanvas, useEditor, useSelectionState } from '@redrob-design/vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const editor = useEditor()
const { selectedCount } = useSelectionState()

useCanvas(canvasRef, editor, {
  onReady: () => {
    console.log('Canvas prêt')
  },
})
</script>

<template>
  <div class="grid h-full grid-rows-[1fr_auto]">
    <canvas ref="canvasRef" class="size-full" />
    <div class="border-t px-3 py-2 text-xs text-muted">
      Sélection : {{ selectedCount }}
    </div>
  </div>
</template>
```

## Étapes suivantes

- [Architecture](./architecture)
- [Référence de l'API](./api/)
- [useEditor](./api/composables/use-editor)
- [useCanvas](./api/composables/use-canvas)
- [useI18n](./api/composables/use-i18n)

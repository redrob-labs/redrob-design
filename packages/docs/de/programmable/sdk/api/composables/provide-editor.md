---
title: provideEditor
description: Eine Redrob Design-Editor-Instanz über Vue dependency injection bereitstellen.
---

# provideEditor

`provideEditor(editor)` stellt den Editor für composables und headless components weiter unten im Vue component tree bereit.

`useEditor()` basiert auf diesem Context.

## Verwendung

```ts
import { provideEditor } from '@redrob-design/vue'

provideEditor(editor)
```

## Beispiel

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

## Hinweise

Das aktuelle SDK verwendet direkt `provideEditor()` und `useEditor()`. Ältere Beispiele und einzelne Fehlermeldungen erwähnen noch `Redrob DesignProvider`; dieser Component gehört jedoch nicht zum aktuellen öffentlichen API.

## Siehe auch

- [useEditor](./use-editor)

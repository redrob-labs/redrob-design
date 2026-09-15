---
title: provideEditor
description: Udostępnianie instancji edytora Redrob Design komponentom potomnym przez dependency injection.
---

# provideEditor

`provideEditor(editor)` udostępnia edytor Redrob Design funkcjom composable i komponentom bez narzuconych stylów znajdującym się niżej w drzewie Vue.

Na tej funkcji opiera się `useEditor()`.

## Użycie

```ts
import { provideEditor } from '@redrob-design/vue'

provideEditor(editor)
```

## Przykład

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

## Uwagi

Aktualne SDK używa bezpośrednio `provideEditor()` i `useEditor()`. Niektóre starsze przykłady i komunikaty błędów wspominają komponent `Redrob DesignProvider`, ale nie należy on do obecnego publicznego API.

## Zobacz też

- [useEditor](./use-editor)

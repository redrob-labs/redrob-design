---
title: provideEditor
description: Передача экземпляра редактора Redrob Design дочерним компонентам Vue через внедрение зависимостей.
---

# provideEditor

`provideEditor(editor)` делает редактор Redrob Design доступным для composables и компонентов без встроенного оформления, расположенных ниже в дереве Vue.

На этой функции основана работа `useEditor()`.

## Использование

```ts
import { provideEditor } from '@redrob-design/vue'

provideEditor(editor)
```

## Пример

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

## Примечания

В актуальном SDK используются непосредственно `provideEditor()` и `useEditor()`. В некоторых старых примерах и сообщениях об ошибках упоминается компонент `Redrob DesignProvider`, но он не относится к текущему публичному API.

## Связанные API

- [useEditor](./use-editor)

---
title: useViewportKind
description: Flags reactivos Mobile y Desktop para una interfaz de edición propia.
---

# useViewportKind

`useViewportKind()` devuelve una clasificación simplificada del Viewport size utilizada por la UI responsive de Redrob Design.

Usa el composable cuando solo necesites distinguir entre Mobile y Desktop sin configurar `useBreakpoints()` directamente.

## Uso

```ts
import { useViewportKind } from '@redrob-design/vue'

const { isMobile, isDesktop } = useViewportKind()
```

## Values

- `isMobile`
- `isDesktop`

## Consulta también

- [useCanvas](../composables/use-canvas)

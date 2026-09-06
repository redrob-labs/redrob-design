---
title: Examinar archivos con la CLI
description: Consultar páginas, objetos, jerarquías, variables y formatos de documentos `.fig`.
---

# Examinar archivos con la CLI

La CLI permite conocer la estructura de un archivo sin abrir el editor.

```sh
bun redrob-design info design.fig
bun redrob-design pages design.fig
bun redrob-design tree design.fig
```

## Resumen

`info` muestra formato, versión, número de páginas y objetos, tamaño del lienzo, fuentes, variables y metadatos principales.

## Páginas y árbol

`pages` enumera las páginas. `tree` imprime la jerarquía y puede limitar profundidad, página o número de resultados.

```sh
bun redrob-design tree design.fig --depth 3
```

## Buscar objetos

`find` busca por nombre, tipo u otras condiciones.

```sh
bun redrob-design find design.fig --name Button
bun redrob-design find design.fig --type TEXT
```

## Ver un objeto

`node` muestra las propiedades del identificador indicado, incluidas geometría, estilo, relaciones y datos específicos de su tipo.

```sh
bun redrob-design node design.fig 12:34
```

## Variables

`variables` enumera colecciones, modos, tipos y valores.

```sh
bun redrob-design variables design.fig
```

## Formatos

`formats` lista los formatos de documento registrados y sus capacidades de lectura y escritura.

## Salida JSON

Los comandos de consulta admiten `--json`, apropiado para `jq`, CI y programas que necesiten una salida estable y legible por máquinas.

```sh
bun redrob-design pages design.fig --json | jq '.[].name'
```

Usa `bun redrob-design --help` o añade `--help` a un subcomando para ver todas las opciones.

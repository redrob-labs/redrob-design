---
title: Просмотр документов
description: Дерево объектов, поиск по имени и типу и просмотр свойств из терминала.
---

# Просмотр документов

CLI позволяет изучать документы дизайна без запуска редактора. Те же команды работают с открытым настольным приложением, если не указывать файл.

::: tip Установка
```sh
npm install -g @redrob-design/cli
# или
bun add -g @redrob-design/cli
# или
brew install redrob-design/tap/redrob-design
```
:::

## Общие сведения

Количество страниц и объектов, используемые шрифты и размер файла:

```sh
redrob-design info design.fig
```

## Дерево объектов

```sh
redrob-design tree design.fig
```

## Поиск объектов

По типу:

```sh
redrob-design find design.fig --type TEXT
```

По имени:

```sh
redrob-design find design.fig --name "Button"
```

Параметры можно использовать одновременно.

## Запросы XPath

Селекторы XPath находят объекты по типу, атрибутам и положению в дереве:

```sh
redrob-design query design.fig "//FRAME"
```

### По типу

```sh
redrob-design query design.fig "//TEXT"                    # Все текстовые объекты
redrob-design query design.fig "//COMPONENT"               # Все компоненты
redrob-design query design.fig "//INSTANCE"                # Все экземпляры
```

### По атрибутам

```sh
redrob-design query design.fig "//FRAME[@width < 300]"     # Фреймы уже 300 пикселей
redrob-design query design.fig "//*[@cornerRadius > 0]"    # Объекты со скруглёнными углами
redrob-design query design.fig "//*[@visible = false]"     # Скрытые объекты
redrob-design query design.fig "//TEXT[@fontSize >= 24]"   # Крупный текст
redrob-design query design.fig "//*[@opacity < 1]"         # Объекты с неполной прозрачностью
```

### По имени и содержимому

```sh
redrob-design query design.fig "//TEXT[contains(@name, 'Button')]"
redrob-design query design.fig "//TEXT[contains(@text, 'Hello')]"
```

### По иерархии

```sh
redrob-design query design.fig "//SECTION//TEXT"            # Текст внутри секций
redrob-design query design.fig "//FRAME/TEXT"               # Непосредственные текстовые потомки фреймов
redrob-design query design.fig "//COMPONENT_SET//INSTANCE"  # Экземпляры внутри наборов компонентов
```

### Доступные атрибуты

`name`, `width`, `height`, `x`, `y`, `visible`, `opacity`, `cornerRadius`, `fontSize`, `fontFamily`, `fontWeight`, `layoutMode`, `itemSpacing`, `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft`, `strokeWeight`, `rotation`, `locked`, `blendMode`, `text`, `lineHeight`, `letterSpacing`

## Свойства объекта

```sh
redrob-design node design.fig --id 1:23
```

## Страницы и переменные

```sh
redrobdesign pages design.fig
redrob-design variables design.fig
```

## Работа с открытым приложением

Если настольное приложение запущено, не указывайте путь к файлу. CLI подключится по RPC к открытому документу:

```sh
redrob-design documents
redrob-design tree
redrob-design tree --document-id tab-123 --page-id 0:1
redrob-design eval --document-id tab-123 --page-id 0:1 -c "..."
```

Для автоматизированных процессов сначала вызовите `redrob-design documents --json`, а затем явно передавайте `--document-id` и `--page-id`, не полагаясь на видимую активную вкладку или страницу.

## Проверка качества

Проверка имён, компоновки, структуры и доступности:

```sh
redrob-design lint design.fig
redrob-design lint design.pen --preset strict
redrob-design lint design.fig --rule color-contrast
redrob-design lint design.fig --list-rules
```

Добавьте `--json`, если результат будет обрабатывать другая программа.

## Вывод JSON

Все команды поддерживают `--json`. Результат можно передать `jq`, проверке CI или другой программе:

```sh
redrob-design tree design.fig --json | jq '.[] | .name'
```

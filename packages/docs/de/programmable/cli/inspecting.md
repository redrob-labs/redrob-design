---
title: Dateien untersuchen
description: Dokumentbaum, Objekte, Seiten und Variablen über die CLI lesen.
---

# Dateien untersuchen

Die CLI liest `.fig`-Dateien, ohne den Editor zu öffnen. Läuft die Desktop-App, kann der Dateiname entfallen; die CLI verwendet dann RPC für das geöffnete Dokument.

::: tip Installation
```sh
npm install -g @redrob-design/cli
# oder
bun add -g @redrob-design/cli
# oder
brew install redrob-design/tap/redrob-design
```
:::

## Dokumentinformationen

```sh
redrob-design info design.fig
```

Zeigt Seiten, Objektanzahl, verwendete Schriften und Dateigröße.

## Dokumentbaum und Suche

```sh
redrob-design tree design.fig
redrob-design find design.fig --type TEXT
redrob-design find design.fig --name "Button"
```

## XPath-Abfragen

```sh
redrob-design query design.fig "//FRAME"
redrob-design query design.fig "//TEXT[@fontSize >= 24]"
redrob-design query design.fig "//*[@visible = false]"
```

Attributnamen wie `fontSize`, `layoutMode` und `strokeWeight` entsprechen der API und bleiben unverändert.

## Objekte, Seiten und Variablen

```sh
redrob-design node design.fig --id 1:23
redrobdesign pages design.fig
redrob-design variables design.fig
```

## Geöffnetes Dokument

```sh
redrob-design documents
redrob-design tree --document-id tab-123 --page-id 0:1
```

Für automatisierte Abläufe zuerst `redrob-design documents --json` aufrufen und anschließend `--document-id` und `--page-id` ausdrücklich übergeben.

## Qualitätsprüfung

```sh
redrob-design lint design.fig
redrob-design lint design.pen --preset strict
redrob-design lint design.fig --rule color-contrast
```

Alle Befehle unterstützen `--json`.

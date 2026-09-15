---
title: Przeglądanie dokumentów
description: Drzewo obiektów, wyszukiwanie według nazwy i typu oraz właściwości z terminala.
---

# Przeglądanie dokumentów

CLI pozwala analizować dokumenty projektu bez uruchamiania edytora. Te same polecenia działają z otwartą aplikacją komputerową, jeśli nie podasz pliku.

::: tip Instalacja
```sh
npm install -g @redrob-design/cli
# albo
bun add -g @redrob-design/cli
# albo
brew install open-pencil/tap/open-pencil
```
:::

## Informacje ogólne

Liczba stron i obiektów, używane czcionki oraz rozmiar pliku:

```sh
redrob-design info design.fig
```

## Drzewo obiektów

```sh
redrob-design tree design.fig
```

## Wyszukiwanie obiektów

Według typu:

```sh
redrob-design find design.fig --type TEXT
```

Według nazwy:

```sh
redrob-design find design.fig --name "Button"
```

## Zapytania XPath

Selektory XPath wyszukują obiekty według typu, atrybutów i położenia w drzewie:

```sh
redrob-design query design.fig "//FRAME"
```

```sh
redrob-design query design.fig "//TEXT"                    # Wszystkie obiekty tekstowe
redrob-design query design.fig "//COMPONENT"               # Wszystkie komponenty
redrob-design query design.fig "//INSTANCE"                # Wszystkie egzemplarze
redrob-design query design.fig "//FRAME[@width < 300]"     # Ramki węższe niż 300 px
redrob-design query design.fig "//*[@cornerRadius > 0]"    # Obiekty z zaokrąglonymi narożnikami
redrob-design query design.fig "//*[@visible = false]"     # Ukryte obiekty
redrob-design query design.fig "//SECTION//TEXT"            # Tekst wewnątrz sekcji
```

Nazwy dostępnych atrybutów, takie jak `fontSize`, `layoutMode` i `strokeWeight`, pozostają zgodne z API.

## Właściwości obiektu

```sh
redrob-design node design.fig --id 1:23
```

## Strony i zmienne

```sh
openpencil pages design.fig
redrob-design variables design.fig
```

## Praca z otwartą aplikacją

Jeśli aplikacja komputerowa jest uruchomiona, nie podawaj ścieżki pliku. CLI połączy się przez RPC z otwartym dokumentem:

```sh
redrob-design documents
redrob-design tree
redrob-design tree --document-id tab-123 --page-id 0:1
redrob-design eval --document-id tab-123 --page-id 0:1 -c "..."
```

W procesach automatycznych najpierw wywołaj `redrob-design documents --json`, a potem jawnie przekazuj `--document-id` i `--page-id`.

## Kontrola jakości

Sprawdzanie nazw, układu, struktury i dostępności:

```sh
redrob-design lint design.fig
redrob-design lint design.pen --preset strict
redrob-design lint design.fig --rule color-contrast
redrob-design lint design.fig --list-rules
```

## Wyjście JSON

Wszystkie polecenia obsługują `--json`. Wynik można przekazać do `jq`, CI albo innego programu.

---
title: Export mit der CLI
description: PNG, JPG, WEBP, SVG, `.fig`, JSX und HTML exportieren oder Dokumentformate umwandeln.
---

# Export mit der CLI

Die CLI exportiert Rasterbilder, SVG, Teile eines Dokuments als `.fig`, JSX und HTML.

## Formate

```sh
redrob-design export design.fig                           # PNG
redrob-design export design.fig -f jpg -s 2 -q 90        # JPG mit 2×
redrob-design export design.fig -f svg                   # SVG
redrob-design export design.fig -f fig --page "Page 1"   # Seite als .fig
redrob-design export design.fig -f html --css tailwind    # HTML mit Tailwind-Klassen
```

`-f` wählt das Format, `-s` den Maßstab, `-q` die Qualität und `-o` den Ausgabepfad. `--page` und `--node` begrenzen den Export.

## JSX

```sh
redrob-design export design.fig -f jsx --style tailwind
```

`--style openpencil` erzeugt das native JSX-Format des [JSX-Renderers](../jsx-renderer).

## HTML

```sh
redrob-design export design.fig -f html
redrob-design export design.fig -f html --css tailwind
redrob-design export design.fig -f html --html standalone --assets external
```

Der eigenständige HTML-Export wird sofort mit Tailwind kompiliert und benötigt keine Browser-Laufzeit. `--assets external` schreibt CSS und Bilder neben die HTML-Datei. `--fonts assets` speichert aufgelöste Webschriften als lokale `@font-face`-Dateien.

Der HTML-Export dient Übergabe und Weiterverarbeitung, nicht als pixelgenauer Ersatz für die Darstellung auf der Arbeitsfläche.

---
title: Examiner des fichiers avec la CLI
description: Consulter pages, objets, hiérarchies, variables et formats des documents `.fig`.
---

# Examiner des fichiers avec la CLI

La CLI permet de comprendre la structure d’un fichier sans ouvrir l’éditeur.

```sh
bun redrob-design info design.fig
bun redrob-design pages design.fig
bun redrob-design tree design.fig
```

## Résumé

`info` affiche le format, la version, le nombre de pages et d’objets, la taille de la zone de travail, les polices, les variables et les principales métadonnées.

## Pages et arbre

`pages` énumère les pages. `tree` affiche la hiérarchie et peut limiter la profondeur, la page ou le nombre de résultats.

## Rechercher des objets

`find` recherche par nom, type ou autres critères.

```sh
bun redrob-design find design.fig --name Button
bun redrob-design find design.fig --type TEXT
```

## Afficher un objet

`node` affiche les propriétés de l’identifiant indiqué, notamment la géométrie, le style, les relations et les données propres à son type.

## Variables

`variables` énumère collections, modes, types et valeurs.

## Formats

`formats` affiche les formats enregistrés et leurs capacités de lecture et d’écriture.

## Sortie JSON

Les commandes de consultation acceptent `--json`, adapté à `jq`, la CI et aux programmes qui nécessitent une sortie stable et exploitable par une machine.

```sh
bun redrob-design pages design.fig --json | jq '.[].name'
```

Utilisez `bun redrob-design --help` ou ajoutez `--help` à une sous-commande pour voir toutes les options.

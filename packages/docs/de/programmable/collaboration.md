---
title: Zusammenarbeit
description: Eine Datei mit eingeladenen Personen teilen und gemeinsam in Echtzeit bearbeiten, Ende-zu-Ende-verschlüsselt über Redrob Cloud.
---

# Zusammenarbeit

Eine Datei mit eingeladenen Personen teilen und gemeinsam in Echtzeit bearbeiten. Zum Teilen ist eine Anmeldung bei Redrob Cloud nötig (Einstellungen, Cloud); alles andere in Redrob Design funktioniert ohne Konto.

## Eine Datei teilen

1. Oben rechts auf **Teilen** klicken, dann auf **Diese Datei teilen**.
2. Personen per E-Mail einladen und wählen, was sie dürfen: **Kann bearbeiten**, **Kann kommentieren** oder **Kann ansehen**. Wer noch kein Konto hat, bekommt die Datei bei der ersten Anmeldung mit dieser Adresse.
3. **Link kopieren** liefert einen Link, der sich für Personen mit Zugriff öffnet.

Mit dir geteilte Dateien stehen auf der Startseite unter **Mit dir geteilt**.

## Ansichtslinks

**Ansichtslink erstellen** erzeugt einen Link, mit dem jede Person die Datei lesen kann, angemeldet oder nicht. Bearbeiten und Kommentieren sind damit nicht möglich. Ein neuer Link schaltet den alten ab, und **Ausschalten** stoppt ihn sofort.

## Was synchronisiert wird

- **Änderungen am Dokument**, sofort, und die Datei wird in Redrob Cloud gespeichert.
- **Zeiger und Auswahl**, mit Name und Farbe jeder Person.
- **Kommentare und Versionen**, für alle mit Zugriff.

Auf den Avatar einer Person klicken, um ihrer Ansicht zu folgen; erneut klicken, um aufzuhören.

## So funktioniert es

Jede geteilte Datei hat einen eigenen Inhaltsschlüssel, erzeugt auf dem Computer, der sie geteilt hat. Namen, Dokument, Live-Änderungen, Zeiger, Kommentare und Versionen werden damit verschlüsselt, bevor sie den Computer verlassen. Redrob Cloud speichert und leitet nur Chiffretext weiter.

Live-Sitzungen laufen über das Redrob-Cloud-Relay, einen WebSocket der Redrob-Chat-API. Es gibt keine P2P-Verbindung und keinen öffentlichen Signalisierungsserver. Der Dokumentzustand ist ein CRDT (Yjs), daher werden gleichzeitige Änderungen ohne Konflikte zusammengeführt.

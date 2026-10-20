---
title: Współpraca
description: Udostępnij plik zaproszonym osobom i edytujcie go razem w czasie rzeczywistym, z szyfrowaniem end-to-end przez Redrob Cloud.
---

# Współpraca

Udostępnij plik zaproszonym osobom i edytujcie go razem w czasie rzeczywistym. Udostępnianie wymaga zalogowania do Redrob Cloud (Ustawienia, Cloud); reszta Redrob Design działa bez konta.

## Udostępnianie pliku

1. Kliknij **Udostępnij** w prawym górnym rogu, a potem **Udostępnij ten plik**.
2. Zaproś osoby przez e-mail i wybierz uprawnienia: **Może edytować**, **Może komentować** albo **Może wyświetlać**. Osoba bez konta dostanie plik, gdy pierwszy raz zaloguje się tym adresem.
3. **Kopiuj odnośnik** daje odnośnik, który otwiera się osobom z dostępem.

Pliki udostępnione tobie są na stronie głównej w sekcji **Udostępnione tobie**.

## Odnośniki do podglądu

**Utwórz odnośnik do podglądu** daje odnośnik, przez który każdy może czytać plik, zalogowany lub nie. Nie pozwala edytować ani komentować. Nowy odnośnik wyłącza poprzedni, a **Wyłącz** zatrzymuje go od razu.

## Co jest synchronizowane

- **Zmiany w dokumencie** na bieżąco, a plik jest zapisywany w Redrob Cloud.
- **Kursory i zaznaczenia** z imieniem i kolorem każdej osoby.
- **Komentarze i wersje** dla wszystkich z dostępem.

Kliknij awatar współpracownika, aby śledzić jego widok; kliknij ponownie, aby przestać.

## Jak to działa

Każdy udostępniony plik ma własny klucz treści, utworzony na komputerze, z którego go udostępniono. Nazwy, dokument, zmiany na żywo, kursory, komentarze i wersje są nim szyfrowane, zanim opuszczą komputer. Redrob Cloud przechowuje i przekazuje tylko szyfrogram.

Sesje na żywo przechodzą przez przekaźnik Redrob Cloud, WebSocket w API Redrob Chat. Nie ma połączenia P2P ani publicznego serwera sygnalizacyjnego. Stan dokumentu to CRDT (Yjs), więc równoczesne zmiany łączą się bez konfliktów.

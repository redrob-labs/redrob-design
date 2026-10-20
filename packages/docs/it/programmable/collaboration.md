---
title: Collaborazione
description: Condividi un file con le persone che inviti e modificatelo insieme in tempo reale, con crittografia end-to-end tramite Redrob Cloud.
---

# Collaborazione

Condividi un file con le persone che inviti e modificatelo insieme in tempo reale. Per condividere serve l'accesso a Redrob Cloud (Impostazioni, Cloud); tutto il resto di Redrob Design funziona senza account.

## Condividere un file

1. Fai clic su **Condividi** in alto a destra, poi su **Condividi questo file**.
2. Invita le persone per email e scegli cosa può fare ciascuna: **Può modificare**, **Può commentare** o **Può visualizzare**. Chi non ha ancora un account riceve il file al primo accesso con quell'indirizzo.
3. **Copia link** dà un link che si apre per chi ha accesso.

I file condivisi con te sono nella Home, in **Condivisi con te**.

## Link di visualizzazione

**Crea link di visualizzazione** genera un link con cui chiunque può leggere il file, con o senza accesso. Non permette di modificare né di commentare. Un nuovo link disattiva il precedente, e **Disattiva** lo ferma subito.

## Cosa si sincronizza

- **Modifiche al documento**, subito, e il file resta salvato in Redrob Cloud.
- **Cursori e selezioni**, con il nome e il colore di ciascuno.
- **Commenti e versioni**, per tutti quelli che hanno accesso.

Fai clic sull'avatar di un collaboratore per seguirne la vista; fai di nuovo clic per smettere.

## Come funziona

Ogni file condiviso ha la propria chiave del contenuto, creata sul computer che l'ha condiviso. Nomi, documento, modifiche in tempo reale, cursori, commenti e versioni vengono cifrati con essa prima di lasciare il computer. Redrob Cloud conserva e inoltra solo testo cifrato.

Le sessioni passano per il relay di Redrob Cloud, un WebSocket dell'API di Redrob Chat. Non c'è una connessione P2P né un server di segnalazione pubblico. Lo stato del documento è un CRDT (Yjs), quindi le modifiche simultanee si uniscono senza conflitti.

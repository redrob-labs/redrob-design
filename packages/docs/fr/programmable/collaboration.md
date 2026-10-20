---
title: Collaboration
description: Partagez un fichier avec les personnes que vous invitez et modifiez-le ensemble en temps réel, chiffré de bout en bout via Redrob Cloud.
---

# Collaboration

Partagez un fichier avec les personnes que vous invitez et modifiez-le ensemble en temps réel. Le partage demande une connexion à Redrob Cloud (Réglages, Cloud) ; tout le reste de Redrob Design fonctionne sans compte.

## Partager un fichier

1. Cliquez sur **Partager** en haut à droite, puis sur **Partager ce fichier**.
2. Invitez des personnes par e-mail et choisissez ce que chacune peut faire : **Peut modifier**, **Peut commenter** ou **Peut voir**. Une personne sans compte reçoit le fichier à sa première connexion avec cette adresse.
3. **Copier le lien** donne un lien qui s'ouvre pour les personnes qui ont accès.

Les fichiers partagés avec vous sont sur l'Accueil, dans **Partagés avec vous**.

## Liens de consultation

**Créer un lien de consultation** donne un lien avec lequel n'importe qui peut lire le fichier, connecté ou non. Il ne permet ni de modifier ni de commenter. Un nouveau lien désactive l'ancien, et **Désactiver** l'arrête aussitôt.

## Ce qui se synchronise

- **Les modifications du document**, aussitôt, et le fichier est enregistré dans Redrob Cloud.
- **Les curseurs et sélections**, avec le nom et la couleur de chacun.
- **Les commentaires et versions**, pour toutes les personnes qui ont accès.

Cliquez sur l'avatar d'un collaborateur pour suivre sa vue ; cliquez à nouveau pour arrêter.

## Fonctionnement

Chaque fichier partagé a sa propre clé de contenu, créée sur l'ordinateur qui l'a partagé. Noms, document, modifications en direct, curseurs, commentaires et versions sont chiffrés avec elle avant de quitter l'ordinateur. Redrob Cloud ne stocke et ne transmet que du texte chiffré.

Les sessions passent par le relais Redrob Cloud, un WebSocket de l'API Redrob Chat. Il n'y a ni connexion P2P ni serveur de signalisation public. L'état du document est un CRDT (Yjs) : les modifications simultanées se fusionnent sans conflit.

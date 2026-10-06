---
title: Collaboration
description: Share a file with the people you invite and edit it together in real time, end-to-end encrypted through Redrob Cloud.
---

# Collaboration

Share a file with the people you invite and edit it together in real time. Sharing needs a Redrob Cloud sign-in (Settings, Cloud); everything else in Redrob Design works without one.

## Sharing a file

1. Click **Share** in the top-right corner, then **Share this file**.
2. Invite people by email and pick what each can do: **Can edit**, **Can comment** or **Can view**. People from other workspaces can be invited too; someone without an account yet gets the file when they first sign in with that address.
3. **Copy link** gives a link that opens for people with access.

Files shared with you are listed on Home under **Shared with you**. To open a link in the desktop app, paste it into **Open a shared file** in the Share popover.

## View links

**Create view link** makes a link anyone can use to read the file, signed in or not. It cannot be used to edit or comment. Making a new view link stops the old one working, and **Turn off** stops it at once.

## Roles

| Role | Edit | Comment | Invite and manage the view link | Change roles, delete the file |
| --- | --- | --- | --- | --- |
| Owner | Yes | Yes | Yes | Yes |
| Can edit | Yes | Yes | Yes | No |
| Can comment | No | Yes | No | No |
| Can view | No | No | No | No |

Viewers and commenters open the file view-only, and Redrob does not change it for them. Removing someone, or changing their role, takes effect for their open session at once.

## What syncs

- **Document changes**: every edit syncs as it happens, and the file is saved in Redrob Cloud for whoever opens it next.
- **Cursors and selections**, with each person's name and colour.
- **Comments and versions**, for everyone with access.

Click a collaborator's avatar to follow their viewport; click again to stop.

## How it works

Every shared file has its own content key, made on the computer that shared it. Names, the document, every live change, cursors, comments and versions are encrypted with it before they leave the computer. Redrob Cloud stores and forwards only ciphertext, and holds the key only wrapped for each person's device, which it cannot unwrap. A view link carries the key in the part of the link after `#`, which browsers never send to a server.

Live sessions go through the Redrob Cloud relay. There is no peer-to-peer connection and no public signalling server. The document state is a CRDT, so concurrent edits merge without conflicts, and two people saving at once both keep their work.

Someone invited while nobody with access is online gets the file's key the next time an editor or owner opens it.

---
title: Working with Redrob
description: Describe and Edit, Plan and Run, Design Memory, Privacy and Cross-check, the free page check, change cards, receipts, language versions, Ship, comments, versions and workspace libraries.
---

# Working with Redrob

Redrob is the assistant built into every file. You talk to it in the thread, it changes real layers on the canvas, and nothing it changes stays until you keep it.

## Describe and Edit

Each file tab has a switch in the tab bar.

- **Describe** shows the canvas to look at, with the thread beside it. You can pan and zoom, but clicks and shortcuts don't edit the file. Click a layer to point at it: it is added to the message as context. Drag to pan. Drag the edge between the canvas and the thread to make the thread wider or narrower, from 340 to 720 pixels. The arrow keys move the edge too.
- **Edit** brings back the layers panel, the toolbar and the properties panel so you can change things by hand.

A brief started on Home opens in Describe. Undo works in both modes.

## Plan and Run

The composer has two modes.

- **Plan** reads your brief and Design Memory first. It asks at most two questions that change the design, each answered with one tap, then starts four directions side by side as top-level frames named `Direction A: …`. Pick one and keep going from there.
- **Run** skips the questions and makes the change with the likeliest answer.

## Design Memory

Design Memory is what Redrob reads before it draws. It holds the file's color variables, the typefaces and corner radii it uses, its components, and the Design System's rules. The card in the thread opens it in full.

Signed out, Design Memory is read from the open file only, on this computer. Signed in to Redrob Cloud (Settings, Cloud), your workspace's tokens, typefaces, rules and prices come first and the file fills in the rest; the last copy keeps working offline, and a workspace admin can set the Privacy level for every member. The `/demo` route shows a sample workspace.

Your own notes on how you like to work live in the Design Memory drawer too. They stay on this computer, and **Download notes** saves them as JSON.

## Privacy and Cross-check

The composer's Privacy level (Standard, High or Strict) decides what rules on this computer swap for placeholders before a request reaches a model: card and account numbers, keys, contact details and names you list. The canvas still gets the real values, and the receipt counts what was kept private. Local agents (ACP, Pi) are not filtered.

Cross-check runs on your Review model. **Fact check** lists what holds up and what does not; **Challenge** argues for and against the direction for up to three rounds. The thread says when the checker comes from the same company as the model that drew.

## The free page check

When a page opens in Describe, Redrob checks it on this computer against the `design-system` lint preset. The check needs no AI and costs nothing. Findings are listed most serious first, each showing where the problem is. **Fix** settles one finding and **Fix all** settles all of them. Each fix is one undo step, and rules without a sure fix stay open for you.

The same preset runs from the CLI:

```sh
redrob-design lint file.fig --preset design-system
```

## Changes, receipts and progress

- While Redrob works, the thread shows each step in plain words.
- Every answer that changes the page ends with a **Changes** card: what was added, removed or changed. **Keep it** or **Put it back**. The latest kept change also offers **Undo**. The whole answer is one undo step.
- The Redrob tab counts changes still waiting for you.
- Every answer has a receipt: the model and who chose it, the price, what was kept private, and Fact check when it ran. There is no cost estimate before you send.
- Each file's conversation is kept on this computer and survives reloads and provider changes.

## Language versions

Ask for a version of a screen in another language. Redrob copies the frame beside the original as `Frame (Korean)` and rewrites its copy as a native writer would. Describe shows the languages the page ships in.

## Code and tokens

The Code panel generates **React + Tailwind**. Values bound to variables become classes that read the token, for example `bg-(--action-primary)`. You can download the file's variables as DTCG `tokens.json`, or copy them as CSS variables.

## Ship

**Ship** in the Describe header posts one message, with no AI and no cost. It says what is still open and offers:

- **React + tokens** downloads `Page.jsx` and `tokens.json`.
- **Export for Figma** saves the page's frames as a `.fig`.
- **Publish** uploads the page as a static site to the Publish site bucket you set up in Settings, Storage, separate from the bucket your files sync to. It asks once before the page goes public, checks the address, and **Unpublish** takes it down.
- **Hand to Claude Code** sends the page, `tokens.json`, a brief and a preview to Claude Code over MCP when it is connected, or saves them into `.redrob/handoff/<page>/` (desktop) or a zip (browser), with the prompt to run copied.

Signed in to Redrob Cloud, a shipped page watches the workspace's sources. When a price, a piece of copy or a token changes there, the open page proposes its own update in the thread with **Keep it** and **Put it back**. **Stop watching** ends it. Console learns a hash of the file, never its path.

## Comments, versions and libraries

- **File, Comments** lists the threads. **Add comment**, then click a layer or the canvas, in Describe or Edit. Pins keep their size at any zoom and follow their layer. Reply, resolve and delete in the thread at the pin.
- **File, Version history** keeps a version every 10 minutes while you edit, up to the last 30, plus every version you save by name. **Restore** is one undo step and keeps your latest changes as a version first.
- The library manager's **Workspace** source publishes and reads the libraries everyone in your workspace uses. A publish that would overwrite someone else's newer revision is refused.

All three work on this computer first. Signed in, they sync with your Redrob Cloud workspace, and signed out they say they are not shared. Collaboration sessions also go through the Redrob Cloud relay when signed in, and peer-to-peer otherwise.

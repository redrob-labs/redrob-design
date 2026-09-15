# Upstream

Redrob Design is derived from [OpenPencil](https://github.com/open-pencil/open-pencil)
by Danila Poyarkov and the OpenPencil contributors, under the MIT License. This
file records where the port came from, how upstream work is taken, and what keeps
the attribution from being deleted by accident.

## What kind of fork this is

Not a git fork. This repository's root commit (`b6f6378`, "Initial commit") is a
different product: 802 files with **zero** blobs in common with any OpenPencil
commit. The OpenPencil tree arrived later, already rebranded, at `120e80584`
("Merge pull request #18 from redrob-labs/feat/openpencil-port-tauri").

So there is no merge base. `git merge-base HEAD upstream/master` resolves to
nothing, and every upstream change is taken file by file. Nothing in git knows how
far behind upstream this tree is — `upstream-base.json` does, and only as reliably
as the last person who updated it.

Note also that upstream's default branch is `master`, not `main`.

## The measured base

`upstream-base.json` records the upstream commit this tree was measured against:

| | |
| --- | --- |
| commit | `d82aaff9ea4317f71fcf26dd2051e1ca3b8f70e6` |
| date | 2026-09-04 |
| subject | Merge pull request #644 from open-pencil/fix-i18n-placeholder-baseline |
| shared blobs | 1636 of 3605 tracked files in this tree |

Measured, not remembered. The method: intersect the set of blob hashes in this
tree with the set in every upstream first-parent commit, and take the peak. Two
cheaper methods were tried and rejected:

- **Path-keyed comparison** — the port restructured directories (upstream's
  `apps/desktop/…` layout against this tree's `src/` and `packages/`), so identical
  files compare as missing on both sides and every commit scores zero.
- **`git diff --name-only` counting** — the brand sweep touched most files, so the
  count measures our own edits rather than upstream's movement.

Traces of the derivation are still load-bearing in the code and are deliberately
left alone: the `open-pencil` plugin-data namespace
(`packages/core/src/figma-api/plugin-data.ts`), the `openpencil/v1` clipboard
format (`packages/core/src/clipboard/redrob-design.ts`), the `open-pencil:`
localStorage prefix migration (`src/app/storage/legacy-prefix-migration.ts`), and
the `@open-pencil/yoga-layout` dependency. These are wire and storage formats;
renaming them would break files and clipboards that already exist.

## Taking upstream work

```bash
node scripts/upstream-sync.mjs setup    # add or repoint the upstream remote
node scripts/upstream-sync.mjs fetch    # network
node scripts/upstream-sync.mjs report   # commits not taken yet
node scripts/upstream-sync.mjs files    # paths they touch that we also ship
```

`report` and `files` only read. Nothing is applied automatically: a port has no
merge semantics, and an unattended apply would revert Redrob changes that live in
the same files (the ACP wiring to the Redrob Code engine, the brand tokens, the
Korean locale).

After taking anything:

1. Run `bun run check:upstream-boundary`.
2. Run `bun run check` and `bun run test:unit`.
3. Set `lastSyncedUpstream` in `upstream-base.json` to the upstream commit you
   stopped at. Leave `base` alone.

Use a `sync/upstream-<date>` branch and a merge commit rather than a squash, so the
range you took stays legible.

## What the boundary guard enforces

`scripts/check-upstream-boundary.mjs` (`bun run check:upstream-boundary`) fails the
build when:

1. `upstream-base.json` is missing, unparseable, or records no upstream remote or
   base commit.
2. A file listed under `attribution` is gone or no longer contains a string it must
   contain. Today: `LICENSE` must keep both copyright lines — Danila Poyarkov and
   the OpenPencil contributors as well as Redrob — and `NOTICE` must keep stating
   the derivation.
3. A tracked file appears under an `excludedPrefixes` entry. The list is empty
   because upstream is MIT throughout; `excludedReason` says so on the record, and
   the guard fails if that reason is blank.

One sentence: **add your copyright line, never remove upstream's.** The MIT licence
requires the notice in every copy, and a rebrand sweep is exactly the change that
deletes it without breaking a test.

Both `scripts/` entries are two-line shims, because this repository requires root
scripts to be entrypoints only (`bun run check:arch` enforces it). The
implementations live in `tools/upstream/src/`, as `.mjs` rather than `.ts` so the
boundary check can also run under plain `node` in a CI job that installs nothing.

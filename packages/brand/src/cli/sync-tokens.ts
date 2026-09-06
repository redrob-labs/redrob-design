/**
 * Regenerate every deck's brand token block from the `redrob-brand` resource.
 *
 *   bun --filter @redrob-design/brand tokens
 *
 * `brand-tokens.test.ts` runs the same transform and fails when a checked-in deck
 * no longer matches, so a colour cannot drift into a deck by hand. No first-party
 * decks ship in this package, so the CLI is a no-op on a clean tree.
 */

import { readFile, writeFile } from 'node:fs/promises'

import { DECKS, deckSourcePath, loadRedrobBrandTokens, syncDeckTokens } from '../node.ts'

async function main(): Promise<void> {
  const tokens = await loadRedrobBrandTokens()
  const changed: string[] = []
  for (const deck of DECKS) {
    const file = deckSourcePath(deck)
    const before = await readFile(file, 'utf8')
    const after = syncDeckTokens(before, tokens)
    if (after !== before) {
      await writeFile(file, after, 'utf8')
      changed.push(deck.id)
    }
  }
  process.stdout.write(
    changed.length === 0
      ? `redrob-brand (${tokens.name}): all ${DECKS.length} deck(s) already in sync\n`
      : `redrob-brand (${tokens.name}): updated ${changed.join(', ')}\n`
  )
}

await main()

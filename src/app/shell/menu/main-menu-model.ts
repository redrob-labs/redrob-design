import type { MenuActionNode, MenuEntry } from '@redrob-design/vue'

/** The screen the main menu is trimmed for. */
export type MainMenuScreen = 'home' | 'describe' | 'edit'

export interface MainMenuGroup {
  id: string
  label: string
  items: MenuEntry[]
}

/**
 * What to do with one entry: drop it, keep it and filter its sub, or keep it
 * with its whole sub as it is.
 */
export type MenuTrimDecision = false | true | 'subtree'

type ScreenItemIds = Partial<Record<string, ReadonlySet<string>>>

/** Entries the Home screen can act on; everything else needs an open file. */
const HOME_ITEM_IDS: ScreenItemIds = {
  file: new Set(['new', 'open', 'open-storage-workspace', 'import-design-tokens']),
  view: new Set(['theme'])
}

/**
 * Entries that make sense while describing a file: open, save and export it,
 * undo what Redrob did, and look around. Editing by hand waits for Edit.
 */
const DESCRIBE_ITEM_IDS: ScreenItemIds = {
  file: new Set([
    'new',
    'open',
    'open-recent',
    'open-storage-workspace',
    'import-design-tokens',
    'save',
    'save-as',
    'export-png',
    'export-svg',
    'export-pptx',
    'export-fig',
    'autosave',
    'version-history',
    'comments',
    'close'
  ]),
  edit: new Set(['edit.undo', 'edit.redo']),
  view: new Set(['view.zoom100', 'view.zoomFit', 'zoom-in', 'zoom-out', 'theme'])
}

const SCREEN_ITEM_IDS: Partial<Record<MainMenuScreen, ScreenItemIds>> = {
  home: HOME_ITEM_IDS,
  describe: DESCRIBE_ITEM_IDS
}

/** Settings lives at the top level of the main menu, so nested copies are dropped. */
const TOP_LEVEL_ONLY_IDS = new Set(['settings'])

function isSeparator(entry: MenuEntry): boolean {
  return !isAction(entry)
}

function isAction(entry: MenuEntry): entry is MenuActionNode {
  return !('separator' in entry && entry.separator === true)
}

function menuIdOf(entry: MenuEntry): string | undefined {
  return 'menuId' in entry ? entry.menuId : undefined
}

function subOf(entry: MenuEntry): MenuEntry[] {
  return 'sub' in entry && entry.sub ? entry.sub : []
}

/** Removes leading, trailing and doubled separators left behind by trimming. */
export function tidySeparators(entries: MenuEntry[]): MenuEntry[] {
  const out: MenuEntry[] = []
  for (const entry of entries) {
    if (isSeparator(entry) && (out.length === 0 || isSeparator(out[out.length - 1]))) continue
    out.push(entry)
  }
  while (out.length > 0 && isSeparator(out[out.length - 1])) out.pop()
  return out
}

/**
 * Filters a menu tree. An entry whose sub empties out is dropped, so a
 * submenu never opens onto nothing.
 */
export function trimMenuEntries(
  entries: MenuEntry[],
  decide: (entry: MenuEntry) => MenuTrimDecision
): MenuEntry[] {
  const out: MenuEntry[] = []
  for (const entry of entries) {
    if (!isAction(entry)) {
      out.push(entry)
      continue
    }
    const decision = decide(entry)
    if (decision === false) continue
    const sub = subOf(entry)
    if (decision === 'subtree' || sub.length === 0) {
      out.push(entry)
      continue
    }
    const trimmed = trimMenuEntries(sub, decide)
    if (trimmed.length > 0) out.push({ ...entry, sub: trimmed })
  }
  return tidySeparators(out)
}

/** Builds the groups the logo menu shows on a given screen. */
export function mainMenuGroups(
  groups: MainMenuGroup[],
  screen: MainMenuScreen,
  languageLabel: string
): MainMenuGroup[] {
  const result: MainMenuGroup[] = []
  const screenIds = SCREEN_ITEM_IDS[screen]
  for (const group of groups) {
    const allowed = screenIds?.[group.id]
    if (screenIds && !allowed) continue
    const items = trimMenuEntries(group.items, (entry): MenuTrimDecision => {
      const id = menuIdOf(entry)
      if (id && TOP_LEVEL_ONLY_IDS.has(id)) return false
      if (!allowed) return true
      if (id) return allowed.has(id) ? 'subtree' : false
      // The interface language entry has no menu id; it is useful everywhere.
      if ('label' in entry && entry.label === languageLabel) return 'subtree'
      // Other unnamed submenus (Export) keep whichever children are allowed.
      return subOf(entry).length > 0
    })
    if (items.length > 0) result.push({ id: group.id, label: group.label, items })
  }
  return result
}

import { describe, expect, test } from 'bun:test'

import type { MenuEntry } from '@redrob-design/vue'

import type { MainMenuGroup } from '@/app/shell/menu/main-menu-model'
import { mainMenuGroups, tidySeparators, trimMenuEntries } from '@/app/shell/menu/main-menu-model'

const sep: MenuEntry = { separator: true }
const item = (menuId: string, sub?: MenuEntry[]): MenuEntry => ({ menuId, label: menuId, sub })

function ids(entries: MenuEntry[]): string[] {
  return entries.map((entry) => ('menuId' in entry && entry.menuId ? entry.menuId : '-'))
}

const groups: MainMenuGroup[] = [
  {
    id: 'file',
    label: 'File',
    items: [item('new'), item('open'), sep, item('save'), item('save-as'), sep, item('close')]
  },
  { id: 'edit', label: 'Edit', items: [item('edit.undo')] },
  {
    id: 'view',
    label: 'View',
    items: [
      item('view.zoomFit'),
      sep,
      item('theme', [item('theme-light'), item('theme-dark')]),
      { label: 'Language', sub: [{ label: 'English' }] },
      sep,
      item('preferences', [item('snap-objects'), sep, item('settings')])
    ]
  }
]

describe('main menu model', () => {
  test('tidySeparators drops leading, trailing and doubled separators', () => {
    expect(ids(tidySeparators([sep, item('a'), sep, sep, item('b'), sep]))).toEqual(['a', '-', 'b'])
  })

  test('trimMenuEntries drops a submenu that empties out', () => {
    const trimmed = trimMenuEntries([item('parent', [item('x')]), item('y')], (entry) =>
      'menuId' in entry ? entry.menuId !== 'x' : true
    )
    expect(ids(trimmed)).toEqual(['y'])
  })

  test('the Edit screen keeps every group but moves Settings to the top level', () => {
    const result = mainMenuGroups(groups, 'edit', 'Language')
    expect(result.map((group) => group.id)).toEqual(['file', 'edit', 'view'])
    const preferences = result[2].items.find(
      (entry) => 'menuId' in entry && entry.menuId === 'preferences'
    )
    expect(preferences && 'sub' in preferences ? ids(preferences.sub ?? []) : []).toEqual([
      'snap-objects'
    ])
  })

  test('Describe keeps files, undo and looking around, and drops hand editing', () => {
    const withObject: MainMenuGroup[] = [
      ...groups,
      { id: 'object', label: 'Object', items: [item('selection.group')] }
    ]
    const result = mainMenuGroups(withObject, 'describe', 'Language')
    expect(result.map((group) => group.id)).toEqual(['file', 'edit', 'view'])
    expect(ids(result[0].items)).toEqual(['new', 'open', '-', 'save', 'save-as', '-', 'close'])
    expect(ids(result[1].items)).toEqual(['edit.undo'])
    expect(result[2].items.map((entry) => ('label' in entry ? entry.label : '-'))).toEqual([
      'view.zoomFit',
      '-',
      'theme',
      'Language'
    ])
  })

  test('Home keeps only what works without a file', () => {
    const result = mainMenuGroups(groups, 'home', 'Language')
    expect(result.map((group) => group.id)).toEqual(['file', 'view'])
    expect(ids(result[0].items)).toEqual(['new', 'open'])
    expect(result[1].items.map((entry) => ('label' in entry ? entry.label : '-'))).toEqual([
      'theme',
      'Language'
    ])
    const theme = result[1].items[0]
    expect('sub' in theme ? ids(theme.sub ?? []) : []).toEqual(['theme-light', 'theme-dark'])
  })
})

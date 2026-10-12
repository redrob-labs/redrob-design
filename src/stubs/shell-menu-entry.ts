/**
 * UI-slice stub for `@/app/shell/menu/entry`.
 *
 * These are pure, backend-free helpers over the `MenuEntry` model — the real
 * module's helpers are identical in spirit (they only read/narrow the entry).
 * Reproduced here (rather than imported from the app) so the menu components
 * resolve without pulling the app's shell. Type comes from the i18n stub, which
 * stands in for `@redrob-design/vue`.
 */
import type { MenuActionNode, MenuEntry } from '@redrob-design/vue'

export function isMenuSeparator(entry: MenuEntry) {
  return 'separator' in entry && entry.separator
}

export function isMenuAction(entry: MenuEntry): entry is MenuActionNode {
  return !isMenuSeparator(entry)
}

export function menuLabel(entry: MenuEntry) {
  return isMenuAction(entry) ? entry.label : ''
}

export function menuShortcut(entry: MenuEntry) {
  return isMenuAction(entry) ? entry.shortcut : undefined
}

export function menuDisabled(entry: MenuEntry) {
  return isMenuAction(entry) ? entry.disabled : undefined
}

export function menuSubItems(entry: MenuEntry) {
  return isMenuAction(entry) ? (entry.sub ?? []) : []
}

export function hasMenuSubItems(entry: MenuEntry) {
  return menuSubItems(entry).length > 0
}

export function isMenuCheckbox(entry: MenuEntry) {
  return isMenuAction(entry) && Boolean(entry.onCheckedChange)
}

export function menuChecked(entry: MenuEntry) {
  return isMenuAction(entry) ? entry.checked : undefined
}

export function updateMenuChecked(entry: MenuEntry, checked: boolean) {
  if (isMenuAction(entry)) entry.onCheckedChange?.(checked)
}

export function runMenuAction(entry: MenuEntry) {
  if (isMenuAction(entry)) entry.action?.()
}

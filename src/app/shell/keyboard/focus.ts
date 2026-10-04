function isEditableTarget(target: EventTarget | null | undefined): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}

export function isEditing(event: Event) {
  return event.composedPath().some(isEditableTarget)
}

export function hasDocumentTextSelection(): boolean {
  const selection = window.getSelection()
  return selection !== null && !selection.isCollapsed && selection.toString().length > 0
}

export function isInputElement(element: EventTarget | null | undefined): boolean {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    (element instanceof HTMLElement && element.isContentEditable)
  )
}

const CONTROL_SELECTOR =
  'button, a[href], [role="button"], [role="menuitem"], [role="option"], [role="tab"], select'

/**
 * Enter and Space on a focused control press that control. Editor bindings
 * for those keys must not take them, or keyboard users cannot press buttons.
 */
export function isControlActivation(event: Pick<KeyboardEvent, 'code' | 'composedPath'>): boolean {
  if (event.code !== 'Enter' && event.code !== 'NumpadEnter' && event.code !== 'Space') return false
  return event
    .composedPath()
    .some((target) => target instanceof Element && target.matches(CONTROL_SELECTOR))
}

import { describe, expect, test } from 'bun:test'

import { isControlActivation } from '@/app/shell/keyboard/focus'

class FakeElement extends EventTarget {
  constructor(private readonly selector: string) {
    super()
  }
  matches(selector: string): boolean {
    return selector.split(',').some((part) => part.trim() === this.selector)
  }
}

/** The two members `isControlActivation` reads, on a minimal event. */
function keyEvent(code: string, target: FakeElement): Pick<KeyboardEvent, 'code' | 'composedPath'> {
  return { code, composedPath: () => [target] }
}

describe('control activation', () => {
  const element = globalThis.Element
  test('Enter and Space on a button belong to the button', () => {
    Object.defineProperty(globalThis, 'Element', { value: FakeElement, configurable: true })
    try {
      expect(isControlActivation(keyEvent('Enter', new FakeElement('button')))).toBe(true)
      expect(isControlActivation(keyEvent('Space', new FakeElement('[role="button"]')))).toBe(true)
      expect(isControlActivation(keyEvent('KeyF', new FakeElement('button')))).toBe(false)
      expect(isControlActivation(keyEvent('Enter', new FakeElement('canvas')))).toBe(false)
    } finally {
      Object.defineProperty(globalThis, 'Element', { value: element, configurable: true })
    }
  })
})

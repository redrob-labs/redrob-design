import { describe, expect, test } from 'bun:test'

import {
  hasForbiddenDash,
  hasMixedLatinAndCjk,
  placeholders,
  visibleTranslationText
} from '../src/quality'

describe('translation quality checks', () => {
  test('extracts and removes interpolation placeholders', () => {
    expect(placeholders('移除图片 {name}，尺寸 {width} × {height}')).toEqual([
      'height',
      'name',
      'width'
    ])
    expect(visibleTranslationText('画像 {name} を削除')).toBe('画像  を削除')
  })

  test('does not treat placeholder identifiers as translated Latin text', () => {
    expect(hasMixedLatinAndCjk('画像 {name} を削除')).toBe(false)
    expect(hasMixedLatinAndCjk('查看附件 {name}')).toBe(false)
  })

  test('rejects the dashes Redrob copy never uses', () => {
    for (const dash of ['\u2014', '\u2013', '\u2015', '\u2212']) {
      expect(hasForbiddenDash(`Saved ${dash} replace it`)).toBe(true)
    }
    expect(hasForbiddenDash('Short-dash copy is fine')).toBe(false)
  })

  test('still detects visible Latin text mixed with CJK text', () => {
    expect(hasMixedLatinAndCjk('画像 RedrobDesign を表示')).toBe(true)
    expect(hasMixedLatinAndCjk('APIキーを更新')).toBe(true)
    expect(hasMixedLatinAndCjk('画像を表示')).toBe(false)
  })
})

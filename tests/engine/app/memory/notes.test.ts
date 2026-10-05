import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { createEditor } from '@redrob-design/core/editor'

import { assistantControlsFor } from '@/app/assistant/controls/store'
import { turnContext } from '@/app/assistant/turn/instructions'
import {
  MAX_NOTE_LENGTH,
  addPersonalNote,
  createMemoryNotesStorage,
  exportPersonalNotes,
  loadPersonalNotes,
  personalNotes,
  personalNotesBrief,
  removePersonalNote,
  setNotesStorageForTests,
  updatePersonalNote
} from '@/app/memory/notes/store'

beforeEach(() => setNotesStorageForTests(createMemoryNotesStorage()))
afterEach(() => setNotesStorageForTests(null))

describe('personal notes', () => {
  test('add, edit and delete, oldest first', async () => {
    const first = await addPersonalNote('  I prefer 8px grids  ', 1)
    await addPersonalNote('Sentence case for buttons', 2)
    expect(personalNotes.value.map((note) => note.text)).toEqual([
      'I prefer 8px grids',
      'Sentence case for buttons'
    ])
    if (!first) throw new Error('note not added')
    await updatePersonalNote(first.id, 'I prefer a 4px grid', 3)
    expect(personalNotes.value[0]).toMatchObject({ text: 'I prefer a 4px grid', updatedAt: 3 })
    await removePersonalNote(first.id)
    expect(personalNotes.value.map((note) => note.text)).toEqual(['Sentence case for buttons'])
  })

  test('ignore empty notes and cut long ones', async () => {
    expect(await addPersonalNote('   ')).toBeNull()
    const long = await addPersonalNote('x'.repeat(MAX_NOTE_LENGTH + 50))
    expect(long?.text).toHaveLength(MAX_NOTE_LENGTH)
  })

  test('survive a reload of the store', async () => {
    const storage = createMemoryNotesStorage()
    setNotesStorageForTests(storage)
    await addPersonalNote('Keep it calm', 1)
    setNotesStorageForTests(storage)
    expect(personalNotes.value).toEqual([])
    await loadPersonalNotes()
    expect(personalNotes.value.map((note) => note.text)).toEqual(['Keep it calm'])
  })

  test('download as versioned JSON with every note', async () => {
    await addPersonalNote('Keep it calm', Date.UTC(2026, 9, 6))
    const exported = JSON.parse(exportPersonalNotes(personalNotes.value, Date.UTC(2026, 9, 7)))
    expect(exported).toMatchObject({
      format: 'redrob-design.personal-notes',
      version: 1,
      exportedAt: '2026-10-07T00:00:00.000Z',
      notes: [{ text: 'Keep it calm', createdAt: '2026-10-06T00:00:00.000Z' }]
    })
  })
})

describe('notes in what models read', () => {
  test('only under All my work', async () => {
    await addPersonalNote('I prefer 8px grids')
    const editor = createEditor()
    const controls = assistantControlsFor(editor)

    controls.memory = 'all'
    expect(turnContext(editor)).toContain('- I prefer 8px grids')
    controls.memory = 'project'
    expect(turnContext(editor)).not.toContain('8px grids')
    controls.memory = 'none'
    expect(turnContext(editor)).not.toContain('8px grids')
  })

  test('say nothing when there are no notes', () => {
    expect(personalNotesBrief([])).toBe('')
  })
})

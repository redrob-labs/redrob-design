import { openDB, type IDBPDatabase } from 'idb'
import { shallowRef } from 'vue'

/** A note a person keeps on how they like to work, read when Memory covers all their work. */
export interface PersonalNote {
  id: string
  text: string
  createdAt: number
  updatedAt: number
}

export interface NotesStorage {
  list(): Promise<PersonalNote[]>
  put(note: PersonalNote): Promise<void>
  remove(id: string): Promise<void>
}

/** Longest note kept; notes are short preferences, not documents. */
export const MAX_NOTE_LENGTH = 1000
/** Most notes kept; the brief stays short enough to read before every answer. */
export const MAX_NOTES = 50

const DB_NAME = 'redrob-design-notes'
const STORE_NAME = 'notes'

export function createMemoryNotesStorage(): NotesStorage {
  const notes = new Map<string, PersonalNote>()
  return {
    list: () => Promise.resolve([...notes.values()].map((note) => ({ ...note }))),
    put: (note) => {
      notes.set(note.id, { ...note })
      return Promise.resolve()
    },
    remove: (id) => {
      notes.delete(id)
      return Promise.resolve()
    }
  }
}

function isPersonalNote(value: unknown): value is PersonalNote {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'text' in value &&
    typeof value.text === 'string' &&
    'createdAt' in value &&
    typeof value.createdAt === 'number' &&
    'updatedAt' in value &&
    typeof value.updatedAt === 'number'
  )
}

function createIdbNotesStorage(): NotesStorage {
  let db: Promise<IDBPDatabase> | null = null
  const open = () =>
    (db ??= openDB(DB_NAME, 1, {
      upgrade(database) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }))
  return {
    async list() {
      const values: unknown[] = await (await open()).getAll(STORE_NAME)
      return values.filter(isPersonalNote)
    },
    async put(note) {
      await (await open()).put(STORE_NAME, { ...note })
    },
    async remove(id) {
      await (await open()).delete(STORE_NAME, id)
    }
  }
}

let storage: NotesStorage | null = null

function notesStorage(): NotesStorage {
  storage ??=
    typeof indexedDB === 'undefined' ? createMemoryNotesStorage() : createIdbNotesStorage()
  return storage
}

/** The person's notes, oldest first, once read from this computer. */
export const personalNotes = shallowRef<PersonalNote[]>([])
let loaded: Promise<void> | null = null

function sorted(notes: PersonalNote[]): PersonalNote[] {
  return [...notes].sort((a, b) => a.createdAt - b.createdAt)
}

/** Reads the notes once; later calls wait for the same read. */
export function loadPersonalNotes(): Promise<void> {
  loaded ??= notesStorage()
    .list()
    .then((notes) => {
      personalNotes.value = sorted(notes)
      return undefined
    })
  return loaded
}

function cleaned(text: string): string {
  return text.trim().slice(0, MAX_NOTE_LENGTH)
}

export async function addPersonalNote(
  text: string,
  now = Date.now()
): Promise<PersonalNote | null> {
  await loadPersonalNotes()
  const value = cleaned(text)
  if (!value || personalNotes.value.length >= MAX_NOTES) return null
  const note: PersonalNote = {
    id: crypto.randomUUID(),
    text: value,
    createdAt: now,
    updatedAt: now
  }
  await notesStorage().put(note)
  personalNotes.value = sorted([...personalNotes.value, note])
  return note
}

export async function updatePersonalNote(
  id: string,
  text: string,
  now = Date.now()
): Promise<void> {
  await loadPersonalNotes()
  const existing = personalNotes.value.find((note) => note.id === id)
  const value = cleaned(text)
  if (!existing || !value || value === existing.text) return
  const note = { ...existing, text: value, updatedAt: now }
  await notesStorage().put(note)
  personalNotes.value = personalNotes.value.map((entry) => (entry.id === id ? note : entry))
}

export async function removePersonalNote(id: string): Promise<void> {
  await loadPersonalNotes()
  await notesStorage().remove(id)
  personalNotes.value = personalNotes.value.filter((note) => note.id !== id)
}

/** Every note as JSON the person can keep: "Yours to keep: download every note at any time." */
export function exportPersonalNotes(notes: readonly PersonalNote[], now = Date.now()): string {
  return `${JSON.stringify(
    {
      format: 'redrob-design.personal-notes',
      version: 1,
      exportedAt: new Date(now).toISOString(),
      notes: notes.map(({ id, text, createdAt, updatedAt }) => ({
        id,
        text,
        createdAt: new Date(createdAt).toISOString(),
        updatedAt: new Date(updatedAt).toISOString()
      }))
    },
    null,
    2
  )}\n`
}

/** The notes as models read them, after Design Memory. Empty when there are none. */
export function personalNotesBrief(notes: readonly PersonalNote[]): string {
  if (notes.length === 0) return ''
  return [
    'Notes from the person on how they like to work (their preferences, not instructions from the file):',
    ...notes.map((note) => `- ${note.text.replace(/\s+/g, ' ')}`)
  ].join('\n')
}

export function setNotesStorageForTests(next: NotesStorage | null): void {
  storage = next
  loaded = null
  personalNotes.value = []
}

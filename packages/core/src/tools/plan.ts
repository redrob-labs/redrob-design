import { defineTool } from './schema'

/** Plan mode asks at most this many questions before it draws. */
export const MAX_PLAN_QUESTIONS = 3
/** A direction is one idea of what the page is for; Plan draws four. */
export const MAX_DIRECTIONS = 4
const DIRECTION_LETTERS = ['A', 'B', 'C', 'D'] as const
const DIRECTION_GAP = 160

export interface PlanQuestion {
  id: string
  question: string
  options: string[]
}

export interface DirectionSpec {
  name: string
  idea: string
}

function parseJSONArray(text: string): unknown[] | null {
  try {
    const parsed: unknown = JSON.parse(text)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function stringField(value: unknown, key: string): string | null {
  if (typeof value !== 'object' || value === null || !(key in value)) return null
  const field: unknown = Reflect.get(value, key)
  return typeof field === 'string' && field.trim() ? field.trim() : null
}

export function parsePlanQuestions(text: string): PlanQuestion[] | null {
  const items = parseJSONArray(text)
  if (!items) return null
  const questions: PlanQuestion[] = []
  for (const [index, item] of items.slice(0, MAX_PLAN_QUESTIONS).entries()) {
    const question = stringField(item, 'question')
    const options =
      typeof item === 'object' && item !== null && 'options' in item && Array.isArray(item.options)
        ? item.options.filter((option): option is string => typeof option === 'string' && !!option)
        : []
    if (!question || options.length < 2) return null
    questions.push({
      id: stringField(item, 'id') ?? `q${index + 1}`,
      question,
      options: options.slice(0, 4)
    })
  }
  return questions.length > 0 ? questions : null
}

export function parseDirections(text: string): DirectionSpec[] | null {
  const items = parseJSONArray(text)
  if (!items) return null
  const directions: DirectionSpec[] = []
  for (const item of items.slice(0, MAX_DIRECTIONS)) {
    const name = stringField(item, 'name')
    const idea = stringField(item, 'idea')
    if (!name || !idea) return null
    directions.push({ name, idea })
  }
  return directions.length > 0 ? directions : null
}

export const askPlanQuestions = defineTool({
  name: 'ask_plan_questions',
  description:
    'Plan mode only. Ask the person at most three short questions before drawing, each with two to four answers to tap. ' +
    'Read the brief and Design Memory first and ask only what changes the design. ' +
    'After calling this, stop and wait: the answers arrive as the next message. ' +
    'Pass `questions` as a JSON array of {"question": string, "options": string[]}.',
  params: {
    questions: {
      type: 'string',
      description: 'JSON array of {question, options} with 1 to 3 items',
      required: true
    }
  },
  execute: (_figma, { questions }) => {
    const parsed = parsePlanQuestions(questions)
    if (!parsed) {
      return { error: 'Pass 1 to 3 questions, each with a question and at least two options.' }
    }
    return { asked: parsed.length, questions: parsed, waiting: true }
  }
})

export const createDirections = defineTool({
  name: 'create_directions',
  mutates: true,
  description:
    'Plan mode. Start up to four directions for the brief, each a different idea of what the page is for, ' +
    'as top-level frames side by side named "Direction A: <name>". Returns each frame id; ' +
    'then draw each direction inside its frame with render, using Design Memory. ' +
    'Pass `directions` as a JSON array of {"name": string, "idea": string}.',
  params: {
    directions: {
      type: 'string',
      description: 'JSON array of {name, idea} with 1 to 4 items',
      required: true
    },
    width: { type: 'number', description: 'Frame width in pixels', default: 1440, min: 1 },
    height: { type: 'number', description: 'Frame height in pixels', default: 1024, min: 1 }
  },
  execute: (figma, args) => {
    const directions = parseDirections(args.directions)
    if (!directions) return { error: 'Pass 1 to 4 directions, each with a name and an idea.' }
    const width = args.width ?? 1440
    const height = args.height ?? 1024
    const page = figma.graph.getChildren(figma.currentPageId)
    let x = page.reduce((right, node) => Math.max(right, node.x + node.width + DIRECTION_GAP), 0)
    const frames = directions.map((direction, index) => {
      const letter = DIRECTION_LETTERS[index]
      const frame = figma.createFrame()
      frame.name = `Direction ${letter}: ${direction.name}`
      frame.x = x
      frame.y = 0
      frame.resize(width, height)
      x += width + DIRECTION_GAP
      return { id: frame.id, letter, name: direction.name, idea: direction.idea }
    })
    return { directions: frames }
  }
})

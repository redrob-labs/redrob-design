/**
 * Redrob Code's `question` tool, answered from this app.
 *
 * Over `redrob acp --attach` the engine runs in the shared daemon, where the `question` tool is
 * on: the tool call reaches the chat as an ordinary ACP tool call and then waits until someone
 * replies on the daemon's question route (`GET /question`, `POST /question/:id/reply`; see
 * packages/redrob/src/tool/question.ts and server/routes/instance/httpapi/groups/question.ts in
 * redrob-code). ACP itself carries no reply, so without this the call stays "running" forever.
 */
import { engineFetch } from '@/app/ai/engine/auth'

export type EngineQuestionOption = { label: string; description: string }

export type EngineQuestion = {
  question: string
  header: string
  options: EngineQuestionOption[]
  multiple?: boolean
  custom?: boolean
}

type PendingQuestion = { id: string; tool?: { callID: string } }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Whether a tool call is the engine's `question` tool. */
export function isEngineQuestionTool(toolName: string): boolean {
  return toolName.trim().toLowerCase() === 'question'
}

/** The questions in the tool call's input, or none when the input is not the expected shape. */
export function engineQuestions(input: unknown): EngineQuestion[] {
  if (!isRecord(input) || !Array.isArray(input.questions)) return []
  const questions: EngineQuestion[] = []
  for (const item of input.questions) {
    if (!isRecord(item) || typeof item.question !== 'string' || !item.question.trim()) continue
    const options = Array.isArray(item.options)
      ? item.options.flatMap((option) =>
          isRecord(option) && typeof option.label === 'string' && option.label.trim()
            ? [
                {
                  label: option.label,
                  description: typeof option.description === 'string' ? option.description : ''
                }
              ]
            : []
        )
      : []
    questions.push({
      question: item.question,
      header: typeof item.header === 'string' ? item.header : '',
      options,
      multiple: item.multiple === true,
      custom: item.custom !== false
    })
  }
  return questions
}

/** The engine instance the ACP session runs in: the session's cwd, which is the home folder. */
async function sessionDirectory(): Promise<string> {
  const { homeDir } = await import('@tauri-apps/api/path')
  return homeDir()
}

async function pendingRequestFor(callID: string, directory: string): Promise<string | null> {
  const response = await engineFetch(`/question?directory=${encodeURIComponent(directory)}`)
  if (!response.ok) return null
  const list: unknown = await response.json()
  if (!Array.isArray(list)) return null
  const match = list.find(
    (item): item is PendingQuestion =>
      isRecord(item) &&
      typeof item.id === 'string' &&
      isRecord(item.tool) &&
      item.tool.callID === callID
  )
  return match?.id ?? null
}

/**
 * Sends the person's answers (one array of labels per question, in order) back to the engine.
 * Returns false when the question is no longer pending there.
 */
export async function answerEngineQuestion(callID: string, answers: string[][]): Promise<boolean> {
  const directory = await sessionDirectory()
  const requestID = await pendingRequestFor(callID, directory)
  if (!requestID) return false
  const response = await engineFetch(
    `/question/${encodeURIComponent(requestID)}/reply?directory=${encodeURIComponent(directory)}`,
    { method: 'POST', body: JSON.stringify({ answers }) }
  )
  return response.ok
}

/** Dismisses the question, so the engine's turn goes on without an answer. */
export async function dismissEngineQuestion(callID: string): Promise<boolean> {
  const directory = await sessionDirectory()
  const requestID = await pendingRequestFor(callID, directory)
  if (!requestID) return false
  const response = await engineFetch(
    `/question/${encodeURIComponent(requestID)}/reject?directory=${encodeURIComponent(directory)}`,
    { method: 'POST' }
  )
  return response.ok
}

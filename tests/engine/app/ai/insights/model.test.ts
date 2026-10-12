import { describe, expect, test } from 'bun:test'

import type { OrtRuntime, WorkClassifier } from '@redrob-labs/work-labeller'

import { appWorkModelDeps } from '@/app/ai/insights/desktop'
import { createWorkModel, RETRY_DELAYS_MS, type WorkModelDeps } from '@/app/ai/insights/model'

const runtime: OrtRuntime = {
  InferenceSession: {
    create: async () => ({ run: async () => ({}), inputNames: [] })
  },
  Tensor: class {
    readonly dims: readonly number[] = []
  }
}
const classifier: WorkClassifier = {
  id: 'test',
  label: async () => ({ action: null, family: null, confidence: 0 })
}

function deps(overrides: Partial<WorkModelDeps> = {}) {
  let clock = 0
  const timers: { run: () => void; ms: number }[] = []
  const calls = { download: 0, read: [] as string[] }
  const value: WorkModelDeps = {
    isDesktop: true,
    download: async (_request, onProgress) => {
      calls.download += 1
      onProgress({ file: 'model_int8.onnx', received: 50, total: 100 })
      return '/data/models/insights/rev'
    },
    readFile: async (_directory, name) => {
      calls.read.push(name)
      return new Uint8Array()
    },
    loadRuntime: async () => runtime,
    createClassifier: async () => classifier,
    now: () => clock,
    setTimer: (run, ms) => timers.push({ run, ms }),
    ...overrides
  }
  return { value, timers, calls, advance: (ms: number) => (clock += ms) }
}

describe('work model', () => {
  test('the browser build never downloads', async () => {
    let downloads = 0
    const { value } = deps({
      isDesktop: false,
      download: async () => {
        downloads += 1
        return ''
      }
    })
    const model = createWorkModel(value)
    expect(model.state.value).toEqual({ status: 'unavailable' })
    await model.request()
    await model.request()
    expect(downloads).toBe(0)
    expect(model.classifier()).toBeNull()
    expect(model.state.value).toEqual({ status: 'unavailable' })
  })

  test('the app outside Tauri is the browser build', async () => {
    const model = createWorkModel(appWorkModelDeps())
    expect(model.state.value).toEqual({ status: 'unavailable' })
    await model.request()
    expect(model.state.value).toEqual({ status: 'unavailable' })
  })

  test('nothing downloads until requested; then it is ready', async () => {
    const { value, calls } = deps()
    const states: string[] = []
    const model = createWorkModel({
      ...value,
      download: async (request, onProgress) => {
        expect(request.files.map((file) => file.name)).toEqual([
          'model_int8.onnx',
          'tokenizer.json'
        ])
        expect(request.files.every((file) => /^[0-9a-f]{64}$/.test(file.sha256))).toBe(true)
        onProgress({ file: 'model_int8.onnx', received: 50, total: 100 })
        states.push(JSON.stringify(model.state.value))
        return value.download(request, onProgress)
      }
    })
    expect(model.state.value).toEqual({ status: 'absent' })
    expect(calls.download).toBe(0)
    await model.request()
    expect(states[0]).toBe(JSON.stringify({ status: 'downloading', percent: 50 }))
    expect(model.state.value).toEqual({ status: 'ready' })
    expect(calls.read.sort()).toEqual(['model_int8.onnx', 'tokenizer.json'])
    expect(model.classifier()).toBe(classifier)
    await model.request()
    expect(calls.download).toBe(1)
  })

  test('a failure retries after 1 min, 5 min, 30 min, then every 2 h', async () => {
    let attempts = 0
    const { value, timers, advance } = deps({
      download: async () => {
        attempts += 1
        throw new Error('not enough free space')
      }
    })
    const model = createWorkModel(value)
    await model.request()
    expect(model.state.value).toMatchObject({ status: 'failed', reason: 'not enough free space' })
    // Asking again before the retry is due does nothing.
    await model.request()
    expect(attempts).toBe(1)
    for (const expected of [...RETRY_DELAYS_MS, RETRY_DELAYS_MS[3]]) {
      const timer = timers.at(-1)
      expect(timer?.ms).toBe(expected)
      advance(expected)
      timer?.run()
      await Promise.resolve()
      await model.request()
    }
    expect(timers.map((timer) => timer.ms)).toEqual([
      60_000, 300_000, 1_800_000, 7_200_000, 7_200_000, 7_200_000
    ])
  })

  test('one download at a time', async () => {
    let release: () => void = () => undefined
    let downloads = 0
    const { value } = deps({
      download: async () => {
        downloads += 1
        await new Promise<void>((resolve) => {
          release = resolve
        })
        return '/dir'
      }
    })
    const model = createWorkModel(value)
    const first = model.request()
    const second = model.request()
    release()
    await Promise.all([first, second])
    expect(downloads).toBe(1)
  })
})

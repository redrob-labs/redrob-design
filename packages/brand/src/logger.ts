/**
 * Minimal structured logger interface used by the DTCG importer to emit
 * step-named events. Consumers inject a wrapper; tests pass a spy. Defaults to
 * a no-op so callers without logging needs pay nothing.
 */
export interface CoreLogger {
  info: (event: string, data?: Record<string, unknown>) => void
  warn: (event: string, data?: Record<string, unknown>) => void
  error: (event: string, data?: Record<string, unknown>) => void
}

export const NOOP_LOGGER: CoreLogger = {
  info: () => {},
  warn: () => {},
  error: () => {}
}

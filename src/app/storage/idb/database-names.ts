/** Stable names for the app's independent IndexedDB databases. */
export const APP_DATABASE_NAMES = {
  credentials: 'redrob-design-credentials',
  libraries: 'redrob-design-libraries',
  localCanvas: 'redrob-design-cloud-local',
  outbox: 'redrob-design-cloud-outbox',
  recovery: 'redrob-design-recovery',
  diagnostics: 'redrob-design-diagnostics'
} as const

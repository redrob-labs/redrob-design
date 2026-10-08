/** Stable names for the app's independent IndexedDB databases. */
export const APP_DATABASE_NAMES = {
  comments: 'redrob-design-comments',
  credentials: 'redrob-design-credentials',
  history: 'redrob-design-history',
  libraries: 'redrob-design-libraries',
  /** This installation's device key pair and the file keys it has unwrapped. */
  cloudKeys: 'redrob-design-cloud-keys',
  localCanvas: 'redrob-design-cloud-local',
  outbox: 'redrob-design-cloud-outbox',
  recovery: 'redrob-design-recovery',
  diagnostics: 'redrob-design-diagnostics'
} as const

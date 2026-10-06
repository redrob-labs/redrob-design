import { params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

export const settingsMessageDefaults = {
  title: 'Settings',
  description: 'Manage integrations and app preferences.',
  general: 'General',
  languageDescription: 'Choose the language used by the app interface.',
  editing: 'Editing',
  snappingDescription: 'Control alignment while editing paths, moving, and resizing layers.',
  snapToGeometry: 'Snap to geometry',
  snapToGeometryDescription: 'Align dragged vector points to other points in the path.',
  snapToObjects: 'Snap to objects',
  snapToObjectsDescription:
    'Align vector points and layer bounds to nearby layer edges and centers.',
  snapToPixelGrid: 'Snap to pixel grid',
  snapToPixelGridDescription:
    'Align vector points, moved layers, and resized edges to whole pixels.',
  temporaryDisableSnappingHint: 'Hold Control while dragging to temporarily disable snapping.',
  aiAndAgents: 'AI & agents',
  usage: 'Usage',
  diagnostics: 'Diagnostics',
  media: 'Media',
  automation: 'MCP & automation',
  storage: 'Cloud storage',
  mobilePanelNavigation: 'Mobile panel navigation',
  notifications: 'Notifications',

  navPreferences: 'Preferences',
  navConnections: 'Connections',
  navAccount: 'Account',
  sectionAgentsAndMCP: 'Agents and MCP',
  sectionStorage: 'Storage',
  sectionCloud: 'Redrob Cloud',
  appearance: 'Appearance',
  theme: 'Theme',
  themeDescription: 'The canvas page follows it, unless the page has its own color.',
  themeSystem: 'System',
  themeLight: 'Light',
  themeDark: 'Dark',
  language: 'Language',
  interfaceLanguageDescription:
    'The language of Redrob Design itself. What you make is in whatever language you ask for in the chat.',
  files: 'Files',
  autosave: 'Autosave',
  autosaveDescription:
    'Saves this file a second after you stop, once it has a place on this computer.',
  keepUnsavedWorkSafe: 'Keep unsaved work safe',
  keepUnsavedWorkSafeDescription:
    'A copy stays on this computer, so a crash or a closed laptop loses nothing.',
  canvas: 'Canvas',
  canvasSnappingHint: params('Hold {key} while you drag to turn snapping off for that move.'),
  snapToOtherLayers: 'Snap to other layers',
  snapToOtherLayersDescription: 'Edges and centers line up with the layers nearby.',
  snapToPixelGridShortDescription: 'Positions and sizes round to whole pixels.',
  snapToPointsDescription: 'Points you drag line up with the other points in the path.',
  modelsAndKeys: 'Models and keys',
  modelsAndKeysDescription:
    'The AI makers Redrob Design can use, their keys, saved profiles and which one does each job.',
  imageServices: 'Image services',
  imageServicesDescription: 'Stock photos, and turning pictures into layers you can edit.',
  changesApplyNow: 'Changes apply right away.'
} as const

export const settingsMessages = i18n('settings', settingsMessageDefaults)

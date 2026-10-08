import { i18n } from '#vue/i18n/create'

export const codeMessageDefaults = {
  source: 'Code source',
  sourceDesignJSX: 'Design JSX',
  sourceTailwindJSX: 'React + Tailwind',
  sourceHTMLCSS: 'HTML/CSS',
  editorDesignLabel: 'Design JSX',
  editorHTMLCSSLabel: 'HTML and CSS',
  updating: 'Updating…',
  updatedLive: 'Updated live',
  previewFailed: 'Preview failed',
  generatedReadOnly: 'Generated, read only',
  reset: 'Reset',
  copyJSXReference: 'Copy JSX prop reference to clipboard',
  jsxUpToDate: 'Up to date',
  downloadTokens: 'Download design tokens (DTCG JSON)',
  copyTokensCSS: 'Copy design tokens as CSS variables',
  noTokens: 'This file has no variables to export yet'
} as const

export const codeMessages = i18n('code', codeMessageDefaults)

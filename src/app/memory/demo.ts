import { DESIGN_SYSTEM_RULES } from './rules'
import type { DesignMemory, MemoryColorGroup } from './types'

/**
 * The prototype's Design Memory for Redrob Office, from its `data.js`. Shown
 * only in demo mode; elsewhere a workspace has to be connected first.
 */
const ramp = (prefix: string, hexes: string[]) =>
  hexes.map((hex, index) => ({ token: `${prefix}-${index + 1}`, hex }))

const DEMO_COLORS: MemoryColorGroup[] = [
  {
    name: 'Redrob Blue',
    note: 'Blue acts: buttons, links, focus, selection',
    swatches: ramp('blue', [
      '#EEF4FF',
      '#D9E6FF',
      '#BAD2FF',
      '#8AAFFF',
      '#507FFF',
      '#2B52FF',
      '#1733D5',
      '#09209C',
      '#061460',
      '#030C34'
    ])
  },
  {
    name: 'Grays',
    note: 'Surfaces, borders and ink',
    swatches: [
      { token: 'redrob-white', hex: '#FFFFFF' },
      ...ramp('gray', [
        '#F8F9FB',
        '#EFF1F4',
        '#DFE2E8',
        '#CBCFD7',
        '#AAB0BB',
        '#7C8390',
        '#576071',
        '#292E37',
        '#141719'
      ]),
      { token: 'redrob-black', hex: '#0A0B0C' }
    ]
  },
  {
    name: 'Products',
    note: 'Where you are, never what you read',
    swatches: [
      { token: 'product-router', hex: '#1194DD' },
      { token: 'product-chat', hex: '#149CA0' },
      { token: 'product-code', hex: '#02A252' },
      { token: 'product-desk', hex: '#D87101' },
      { token: 'product-office', hex: '#FE4D3E' },
      { token: 'product-browser', hex: '#F14AA8' },
      { token: 'product-design', hex: '#C162F4' }
    ]
  },
  {
    name: 'Status',
    note: 'Meaning only',
    swatches: [
      { token: 'status-success', hex: '#00864A' },
      { token: 'status-warning', hex: '#AE5100' },
      { token: 'status-danger', hex: '#A31310' },
      { token: 'status-info', hex: '#1733D5' }
    ]
  }
]

const DEMO_COMPONENTS = [
  'AnswerReceipt',
  'Badge',
  'Button',
  'Card',
  'Changes',
  'Checkbox',
  'Composer',
  'Drawer',
  'Finding',
  'Hero',
  'Input',
  'Menu',
  'Modal',
  'PriceTable',
  'PromptSuggestions',
  'Select',
  'SiteFooter',
  'SiteHeader',
  'Stat',
  'Tabs'
]

export const DEMO_MEMORY: DesignMemory = {
  owner: 'Redrob Office',
  origin: 'workspace',
  colors: DEMO_COLORS,
  typefaces: [
    { family: 'Pretendard', note: 'Product, 12 to 56px on the type scale' },
    { family: 'Newsreader', note: 'One statement or a quote' }
  ],
  radii: [4, 6, 8, 12, 16, 24],
  rules: [
    DESIGN_SYSTEM_RULES[0],
    {
      id: 'v2',
      text: 'Every plan shows its price and a way to start.',
      source: 'redrob.io/pricing'
    },
    ...DESIGN_SYSTEM_RULES.slice(1)
  ],
  components: DEMO_COMPONENTS,
  prices: [
    { plan: 'Starter', price: '$0' },
    { plan: 'Team', price: '$24' },
    { plan: 'Business', price: '$48' }
  ]
}

export const DEMO_WORKSPACE = {
  name: 'Redrob Office',
  sources: ['redrob.io', 'Web repository', 'Pricing sheet, Q4']
}

import { EN, EN_PROG } from './labels.ts'
import { sdkSidebar } from './sdk-sidebar.ts'
import {
  developmentSidebar,
  guideSidebar,
  programmableSidebar,
  referenceSidebar,
  userGuideSidebar,
} from './sidebars.ts'

import type { DefaultTheme } from 'vitepress'

export const rootThemeConfig = (): DefaultTheme.Config => ({
  search: { provider: 'local' },

  nav: [
    { text: 'Overview', link: '/getting-started' },
    { text: 'User Guide', link: '/user-guide/' },
    { text: 'Automation', link: '/programmable/' },
    { text: 'SDK', link: '/programmable/sdk/' },
    { text: 'Reference', link: '/reference/keyboard-shortcuts' },
    { text: 'Development', link: '/development/contributing' },
    { text: 'Open App', link: 'https://app.redrob.design' },
  ],

  sidebar: {
    '/user-guide/': userGuideSidebar('', EN),
    '/programmable/sdk/': sdkSidebar(''),
    '/programmable/': programmableSidebar('', EN_PROG),
    '/reference/': referenceSidebar('', 'Reference', EN),
    '/development/': developmentSidebar('', 'Development', EN),
    '/': guideSidebar('', EN),
  },

  socialLinks: [{ icon: 'github', link: 'https://github.com/redrob-labs/redrob-design' }],

  editLink: {
    pattern: 'https://github.com/redrob-labs/redrob-design/edit/main/packages/docs/:path',
  },

  footer: {
    message: 'Released under the MIT License.',
  },
})

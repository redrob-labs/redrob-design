/**
 * `@redrob-design/core/constants` stub.
 *
 * The real package enumerates every supported AI provider and ACP agent with
 * their model catalogues. This slice needs only the shape the settings panels
 * read (`AI_PROVIDERS[].{id,name,models,defaultModel,supports*,key*}` and
 * `ACP_AGENTS[].{id,name}`), with a couple of representative entries so the
 * provider/model selects render something real.
 */

export interface AIModelDefinition {
  id: string
  name: string
  capabilities: Array<'tools' | 'vision'>
  recommendedMaxOutputTokens?: number
}

export interface AIProviderDefinition {
  id: string
  name: string
  models: AIModelDefinition[]
  defaultModel: string
  supportsCustomModel: boolean
  supportsCustomBaseURL: boolean
  keyPlaceholder: string
  keyURL: string
}

export type AIProviderID = string

export const AI_PROVIDERS: AIProviderDefinition[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    models: [
      { id: 'gpt-5', name: 'GPT-5', capabilities: ['tools', 'vision'], recommendedMaxOutputTokens: 32_768 },
      { id: 'gpt-5-mini', name: 'GPT-5 mini', capabilities: ['tools'], recommendedMaxOutputTokens: 16_384 }
    ],
    defaultModel: 'gpt-5',
    supportsCustomModel: true,
    supportsCustomBaseURL: false,
    keyPlaceholder: 'sk-…',
    keyURL: 'https://platform.openai.com/api-keys'
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    models: [
      { id: 'claude-sonnet-4.5', name: 'Claude Sonnet 4.5', capabilities: ['tools', 'vision'], recommendedMaxOutputTokens: 32_768 }
    ],
    defaultModel: 'claude-sonnet-4.5',
    supportsCustomModel: true,
    supportsCustomBaseURL: false,
    keyPlaceholder: 'sk-ant-…',
    keyURL: 'https://console.anthropic.com/settings/keys'
  },
  {
    id: 'openai-compatible',
    name: 'OpenAI-compatible',
    models: [],
    defaultModel: '',
    supportsCustomModel: true,
    supportsCustomBaseURL: true,
    keyPlaceholder: 'Your API key',
    keyURL: ''
  },
  {
    id: 'redrob',
    name: 'Redrob',
    models: [{ id: 'auto', name: 'Redrob Auto', capabilities: ['tools', 'vision'] }],
    defaultModel: 'auto',
    supportsCustomModel: false,
    supportsCustomBaseURL: false,
    keyPlaceholder: 'Workspace key',
    keyURL: ''
  }
]

export interface ACPAgentDefinition {
  id: string
  name: string
}

export const ACP_AGENTS: ACPAgentDefinition[] = [
  { id: 'redrob-code', name: 'Redrob Code' }
]

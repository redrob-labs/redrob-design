import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import Composer from './Composer.vue'
import ComposerMode from './ComposerMode.vue'
import ComposerStatus from './ComposerStatus.vue'
import CrossCheckSetting from './CrossCheckSetting.vue'
import MemoryScope from './MemoryScope.vue'
import ModelPicker from './ModelPicker.vue'
import PrivacyProtection from './PrivacyProtection.vue'
import type { ModelPick } from './types'

const picks: ModelPick[] = [
  {
    id: 'a',
    model: 'Claude Opus 5.5',
    short: 'Opus 5.5',
    harness: 'Redrob Design',
    effort: { label: 'High', level: 3, of: 5 },
    efforts: [
      { label: 'Low', level: 1, of: 5 },
      { label: 'Medium', level: 2, of: 5 },
      { label: 'High', level: 3, of: 5 }
    ],
    why: 'Builds real layers on the canvas from your Design System.'
  },
  {
    id: 'b',
    model: 'GPT-6 Astra',
    harness: 'ChatGPT Work',
    effort: { label: 'High', level: 3, of: 5 },
    why: 'Returns images and code, not editable layers.'
  }
]

type ComposerProps = {
  label: string
  submitLabel: string
  stopLabel: string
  busy?: boolean
}

const meta = {
  title: 'Agent/Composer',
  component: Composer
} satisfies Meta<ComposerProps>

export default meta
type Story = StoryObj<ComposerProps>

/** Desk's composer as Design uses it: Plan or Run and the picker in the bar, the promises under it. */
export const Full: Story = {
  args: { label: 'Describe a change', submitLabel: 'Send', stopLabel: 'Stop' },
  render: (args) => ({
    components: {
      Composer,
      ComposerMode,
      ComposerStatus,
      CrossCheckSetting,
      MemoryScope,
      ModelPicker,
      PrivacyProtection
    },
    setup: () => ({
      args,
      text: ref(''),
      mode: ref<'plan' | 'run'>('plan'),
      pick: ref<string | null>(null),
      effort: ref<number | null>(null),
      memory: ref('project'),
      checks: ref({ factCheck: 'always' as const, challenge: 'auto' as const }),
      picks
    }),
    template: `
      <div class="w-[560px] bg-canvas p-6">
        <Composer v-bind="args" v-model="text" placeholder="What are you making?" add-label="Add files">
          <template #tools>
            <ComposerMode
              v-model="mode"
              label="How Redrob works"
              :options="[{ value: 'plan', label: 'Plan' }, { value: 'run', label: 'Run' }]"
            />
            <ModelPicker
              v-model="pick"
              v-model:effort="effort"
              :picks="picks"
              here="Redrob Design"
              label="Model"
              auto-label="Redrob Auto"
              auto-text="Each message goes to the highest place that runs here."
              heading="Top 5"
              effort-label="Effort"
              :away-label="(h) => 'Runs in ' + h"
            />
          </template>
          <template #status>
            <ComposerStatus
              label="How Redrob treats every message"
              :items="[
                { id: 'privacy', tone: 'safe', name: 'Privacy', value: 'High', level: { n: 2, of: 3 }, live: 'Running on this computer' },
                { id: 'memory', tone: 'on', name: 'Memory', value: 'On for every AI' },
                { id: 'check', tone: 'on', name: 'Cross-check', value: '2 of 2 on' }
              ]"
            >
              <template #panel-privacy>
                <PrivacyProtection
                  level="high"
                  heading="Privacy protection is on"
                  running="Running on this computer"
                  :levels="[{ id: 'high', label: 'High', n: 2, detail: 'Names and contacts too.' }]"
                />
              </template>
              <template #panel-memory>
                <MemoryScope
                  v-model="memory"
                  label="What Memory reads"
                  on-title="One memory for every AI"
                  off-title="Memory is off"
                  :options="[{ value: 'project', label: 'This product' }, { value: 'none', label: 'Off', off: true }]"
                />
              </template>
              <template #panel-check>
                <CrossCheckSetting
                  v-model="checks"
                  heading="Cross-check"
                  :checks="[{ id: 'factCheck', name: 'Fact check', text: 'About 40 seconds.' }]"
                  :levels="[{ value: 'off', label: 'Off' }, { value: 'auto', label: 'When it matters' }, { value: 'always', label: 'Always' }]"
                />
              </template>
            </ComposerStatus>
          </template>
        </Composer>
      </div>
    `
  })
}

export const Busy: Story = {
  args: { label: 'Describe a change', submitLabel: 'Send', stopLabel: 'Stop', busy: true }
}

import { z } from 'zod'

export const DesignTokenV1 = z.object({
  schemaVersion: z.literal(1).default(1),
  type: z.enum([
    'color',
    'fontFamily',
    'fontSize',
    'spacing',
    'radius',
    'shadow',
    'lineHeight',
    'unknown'
  ]),
  name: z.string().min(1),
  value: z.string().min(1),
  origin: z.enum(['tailwind-config', 'css-vars', 'figma', 'manual', 'pdf', 'dtcg-json']),
  group: z.string().optional()
})
export type DesignToken = z.infer<typeof DesignTokenV1>

export const DesignTokenSet = z.object({
  schemaVersion: z.literal(1).default(1),
  name: z.string().min(1),
  source: z.string().optional(),
  tokens: z.array(DesignTokenV1)
})
export type DesignTokenSet = z.infer<typeof DesignTokenSet>

export const STORED_DESIGN_SYSTEM_SCHEMA_VERSION = 1 as const

const StoredDesignSystemShape = z
  .object({
    schemaVersion: z.literal(STORED_DESIGN_SYSTEM_SCHEMA_VERSION),
    rootPath: z.string().min(1),
    summary: z.string().min(1),
    extractedAt: z.string().min(1),
    sourceFiles: z.array(z.string().min(1)).max(24).default([]),
    colors: z.array(z.string().min(1)).max(24).default([]),
    fonts: z.array(z.string().min(1)).max(16).default([]),
    spacing: z.array(z.string().min(1)).max(16).default([]),
    radius: z.array(z.string().min(1)).max(16).default([]),
    shadows: z.array(z.string().min(1)).max(16).default([]),
    tokens: z.array(DesignTokenV1).max(240).optional()
  })
  .strict()

export const StoredDesignSystem = z.preprocess((raw) => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return raw
  const record = raw as Record<string, unknown>
  if ('schemaVersion' in record) return record
  return { schemaVersion: STORED_DESIGN_SYSTEM_SCHEMA_VERSION, ...record }
}, StoredDesignSystemShape)
export type StoredDesignSystem = z.infer<typeof StoredDesignSystem>

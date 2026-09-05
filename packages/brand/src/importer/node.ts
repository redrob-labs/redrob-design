/**
 * File-reading wrappers around the browser-safe token extractors.
 *
 * The extractors themselves parse a source string, so they stay importable from
 * renderer code; only these `node:fs` wrappers live here.
 */

import { readFile } from 'node:fs/promises'

import type { DesignToken } from '../shared/index.ts'
import { extractFromCssVarsSource } from './cssVarExtractor.ts'
import { extractFromTailwindConfigSource } from './tailwindExtractor.ts'

export async function extractFromCssVars(filePath: string): Promise<DesignToken[]> {
  return extractFromCssVarsSource(await readFile(filePath, 'utf-8'))
}

export async function extractFromTailwindConfig(filePath: string): Promise<DesignToken[]> {
  return extractFromTailwindConfigSource(await readFile(filePath, 'utf-8'))
}

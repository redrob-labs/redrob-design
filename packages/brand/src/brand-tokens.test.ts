/**
 * The `redrob-brand` token resource: does it resolve, and does it still carry the
 * brand values that are on merged main?
 *
 * The resource is a DESIGN.md file in the built-in scaffold collection, so the
 * first question is answered by the app's own validator plus this package's
 * resolver. The second is the one a reviewer cannot answer from a diff:
 * `packages/brand/src/tokens.css` is where a Redrob colour is decided, and if the
 * resource and the stylesheet ever disagree, the assertions below say which value
 * moved.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'bun:test';
import { validateDesignMd } from './shared/design-md.ts';
import {
  loadRedrobBrandTokens,
  REDROB_BRAND_RESOURCE_ID,
  REDROB_BRAND_RESOURCE_NAME,
  REDROB_BRAND_RESOURCE_PATH,
  redrobBrandResourcePath,
  renderBrandTokenCss,
  repoRoot,
  resolveRedrobBrandTokens,
  syncDeckTokens,
  TOKEN_BLOCK_CLOSE,
  TOKEN_BLOCK_OPEN,
} from './index.ts';

const resourceRaw = readFileSync(redrobBrandResourcePath(), 'utf8');
const tokensCss = readFileSync(path.join(repoRoot(), 'packages/brand/src/tokens.css'), 'utf8');
const scaffoldManifest = JSON.parse(
  readFileSync(
    path.join(repoRoot(), 'public/resources/scaffolds/manifest.json'),
    'utf8',
  ),
) as { schemaVersion: number; scaffolds: Record<string, Record<string, unknown>> };

/** `--name: value;` inside a given selector block of tokens.css. */
function cssBlock(selector: string): Record<string, string> {
  const start = tokensCss.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`tokens.css has no ${selector} block`);
  let depth = 0;
  let end = start;
  for (let i = tokensCss.indexOf('{', start); i < tokensCss.length; i += 1) {
    if (tokensCss[i] === '{') depth += 1;
    else if (tokensCss[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const body = tokensCss.slice(start, end);
  const out: Record<string, string> = {};
  for (const match of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    const name = match[1];
    const value = match[2];
    if (name !== undefined && value !== undefined) out[name] = value.trim();
  }
  return out;
}

const rootVars = cssBlock(':root');
const darkVars = cssBlock('.dark');

/** Follow `var(--x)` chains inside tokens.css until a literal lands. */
function resolveCssVar(name: string, theme: 'light' | 'dark'): string | null {
  const seen = new Set<string>();
  let value: string | undefined =
    theme === 'dark' ? (darkVars[name] ?? rootVars[name]) : rootVars[name];
  while (value !== undefined) {
    const ref = /^var\((--[\w-]+)\)$/.exec(value.trim());
    if (ref === null) return value.trim().toLowerCase();
    const next = ref[1];
    if (next === undefined || seen.has(next)) return null;
    seen.add(next);
    value = theme === 'dark' ? (darkVars[next] ?? rootVars[next]) : rootVars[next];
  }
  return null;
}

describe('redrob-brand token resource', () => {
  it('is a valid DESIGN.md in the built-in resource collection', () => {
    const errors = validateDesignMd(resourceRaw).filter((f) => f.severity === 'error');
    expect(errors).toEqual([]);
  });

  it('is registered as a scaffold under its machine name', () => {
    const entry = scaffoldManifest.scaffolds[REDROB_BRAND_RESOURCE_ID];
    expect(entry, `scaffolds.${REDROB_BRAND_RESOURCE_ID}`).toBeDefined();
    expect(entry?.['category']).toBe('design-system');
    expect(entry?.['path']).toBe(REDROB_BRAND_RESOURCE_PATH.replace('scaffolds/', ''));
    expect(entry?.['aliases']).toContain('redrob');
  });

  it('resolves into primitives, both themes, typography and scales', async () => {
    const tokens = await loadRedrobBrandTokens();
    expect(tokens.name).toBe(REDROB_BRAND_RESOURCE_NAME);
    expect(Object.keys(tokens.primitives).length).toBeGreaterThanOrEqual(25);
    expect(Object.keys(tokens.light).length).toBeGreaterThanOrEqual(18);
    expect(Object.keys(tokens.dark).length).toBeGreaterThanOrEqual(16);
    expect(tokens.primitives['rr-blue-6']).toBe('#2b52ff');
    expect(tokens.light['color-accent']).toBe('#2b52ff');
    expect(tokens.rounded['full']).toBe('9999px');
    expect(tokens.spacing['4xl']).toBe('64px');
  });

  it('names Pretendard first on every non-code role', async () => {
    const tokens = await loadRedrobBrandTokens();
    for (const [role, value] of Object.entries(tokens.typography)) {
      if (role === 'mono') {
        expect(value.fontFamily).toMatch(/^"JetBrains Mono/);
        continue;
      }
      expect(value.fontFamily, role).toMatch(/^"Pretendard Variable", Pretendard,/);
    }
    // The vendored face this stack resolves to actually exists in the repo.
    expect(() =>
      readFileSync(
        path.join(repoRoot(), 'packages/brand/src/assets/fonts/pretendard/PretendardVariable.woff2'),
      ),
    ).not.toThrow();
  });

  it('carries the same primitive HEX values as packages/ui/src/tokens.css', async () => {
    const tokens = await loadRedrobBrandTokens();
    for (const [name, hex] of Object.entries(tokens.primitives)) {
      expect(rootVars[`--${name}`]?.toLowerCase(), name).toBe(hex);
    }
  });

  it('points every semantic role at the same primitive tokens.css does', async () => {
    const tokens = await loadRedrobBrandTokens();
    for (const [role, hex] of Object.entries(tokens.light)) {
      expect(resolveCssVar(`--${role}`, 'light'), `light ${role}`).toBe(hex);
    }
    for (const [role, hex] of Object.entries(tokens.dark)) {
      expect(resolveCssVar(`--${role}`, 'dark'), `dark ${role}`).toBe(hex);
    }
  });

  it('rejects a resource that is not a valid DESIGN.md', () => {
    expect(() => resolveRedrobBrandTokens('no frontmatter here')).toThrow(/frontmatter/i);
  });

  it('rejects a colour key that is neither a primitive nor a semantic role', () => {
    const broken = resourceRaw.replace('  rr-blue-6:', '  brandish-blue:');
    expect(() => resolveRedrobBrandTokens(broken)).toThrow(
      /neither a primitive nor a semantic role/,
    );
  });

  it('rejects a dark theme that drops a role light declares', () => {
    const broken = resourceRaw.replace(/^ {2}dark-color-accent: .*$/m, '');
    expect(() => resolveRedrobBrandTokens(broken)).toThrow(/does not re-point/);
  });
});

describe('renderBrandTokenCss', () => {
  it('keeps the two-layer shape: primitives hold HEX, roles point at primitives', async () => {
    const css = renderBrandTokenCss(await loadRedrobBrandTokens());
    expect(css.startsWith(TOKEN_BLOCK_OPEN)).toBe(true);
    expect(css.endsWith(TOKEN_BLOCK_CLOSE)).toBe(true);
    expect(css).toContain('--rr-blue-6: #2b52ff;');
    expect(css).toContain('--color-accent: var(--rr-blue-6);');
    expect(css).toContain('--color-accent: var(--rr-blue-5);');
    expect(css).toContain('--font-sans: "Pretendard Variable"');
    expect(css).toContain('--type-display-size: 64px;');
    expect(css).toContain('--radius-full: 9999px;');
  });
});

describe('syncDeckTokens', () => {
  it('throws when a deck has no generated block to fill', async () => {
    const tokens = await loadRedrobBrandTokens();
    expect(() => syncDeckTokens('<style>body{}</style>', tokens)).toThrow(/no .* block to fill/);
  });

  it('is idempotent', async () => {
    const tokens = await loadRedrobBrandTokens();
    const once = syncDeckTokens(
      `<style>\n  ${TOKEN_BLOCK_OPEN}\n  ${TOKEN_BLOCK_CLOSE}\n</style>`,
      tokens,
    );
    expect(syncDeckTokens(once, tokens)).toBe(once);
  });
});

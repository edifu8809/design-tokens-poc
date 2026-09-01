// Syncs the "gennius" brand from the raw Figma Variables export at
// apps/demo-app/public/tokens.json into this library's own token JSON:
//   - every raw color -> tokens/base/color.json, under color.gennius.<kebab-name>
//   - a hand-picked subset of those, aliased by ROLE -> tokens/brands/gennius/semantic.light.json
//
// Re-run after re-exporting from Figma (`npm run tokens:sync:gennius`). Because ROLE_MAP
// matches by Figma *name* (not by hex), the semantic layer automatically follows if a
// designer changes a swatch's color in Figma without renaming it — no manual edits needed.
// If a name in ROLE_MAP disappears or gets renamed in a future export, this script logs a
// warning instead of guessing a replacement.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '../../..');
const FIGMA_EXPORT_FILE = path.join(REPO_ROOT, 'apps/demo-app/public/tokens.json');
const BASE_COLOR_FILE = path.join(__dirname, 'tokens/base/color.json');
const GENNIUS_LIGHT_FILE = path.join(__dirname, 'tokens/brands/gennius/semantic.light.json');

// Semantic role -> Figma Variable name. Kept to the same role vocabulary mr/cuscatlan use
// (see tokens/brands/mr/semantic.light.json) since libs/shared/ui only reads those exact
// --color-* names. This is an interpretation of what each swatch is *for*, made by reading
// the Figma names themselves — not verified against an actual design spec, so double-check
// these against the real Figma file before shipping gennius to production.
const ROLE_MAP = {
  'brand.primary': 'Gennius Blue',
  'brand.primary-hover': 'Blue-message',
  'brand.primary-contrast': 'White',
  'surface.background': 'White',
  'text.primary': 'Black',
  'text.secondary': 'Marco Cel',
  'text.on-brand': 'White',
  'feedback.success': 'Green',
  'feedback.danger': 'CANCELED',
  'feedback.warning': 'Orange',
};

// No gray/chrome scale exists in the Figma export (only brand-specific swatches) — reuse
// the shared neutral primitives the other brands already use instead of inventing new ones.
const SHARED_ALIASES = {
  'surface.elevated': '{color.neutral.50}',
  'surface.border': '{color.neutral.200}',
};

function toKebabCase(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function resolveValue(value) {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (value && typeof value === 'object') {
    if (typeof value.hex === 'string') return value.hex;
    if (typeof value.css === 'string') return value.css;
  }
  return null;
}

function isTokenNode(node) {
  return Boolean(node) && typeof node === 'object' && '$value' in node;
}

// Figma Variable collections only, matching apps/demo-app/scripts/build-tokens.js — the
// `_styles` entry (paints/text/effects) is a different schema and isn't handled here either.
function extractFigmaColors(raw) {
  const colors = new Map();

  for (const entry of raw) {
    for (const [collectionName, collection] of Object.entries(entry)) {
      if (collectionName === '_styles' || !collection || typeof collection !== 'object' || !collection.modes) {
        continue;
      }

      for (const modeTokens of Object.values(collection.modes)) {
        for (const [name, token] of Object.entries(modeTokens)) {
          if (!isTokenNode(token)) continue;
          const value = resolveValue(token.$value);
          if (value !== null) colors.set(name, value);
        }
      }
    }
  }

  return colors;
}

function setAtPath(target, dottedPath, value) {
  const segments = dottedPath.split('.');
  let node = target;
  for (let i = 0; i < segments.length - 1; i++) {
    node[segments[i]] ??= {};
    node = node[segments[i]];
  }
  node[segments[segments.length - 1]] = value;
}

async function syncBasePrimitives(figmaColors) {
  const baseColors = JSON.parse(await fs.readFile(BASE_COLOR_FILE, 'utf8'));

  baseColors.color.gennius = {};
  for (const [name, value] of figmaColors) {
    baseColors.color.gennius[toKebabCase(name)] = { $type: 'color', $value: value };
  }

  await fs.writeFile(BASE_COLOR_FILE, JSON.stringify(baseColors, null, 2) + '\n');
  return Object.keys(baseColors.color.gennius).length;
}

async function syncSemanticLayer(figmaColors) {
  const semantic = {};
  const missing = [];

  for (const [role, figmaName] of Object.entries(ROLE_MAP)) {
    if (!figmaColors.has(figmaName)) {
      missing.push(`${role} -> "${figmaName}"`);
      continue;
    }
    setAtPath(semantic, role, { $type: 'color', $value: `{color.gennius.${toKebabCase(figmaName)}}` });
  }

  for (const [role, alias] of Object.entries(SHARED_ALIASES)) {
    setAtPath(semantic, role, { $type: 'color', $value: alias });
  }

  await fs.mkdir(path.dirname(GENNIUS_LIGHT_FILE), { recursive: true });
  await fs.writeFile(GENNIUS_LIGHT_FILE, JSON.stringify({ color: semantic }, null, 2) + '\n');

  return { mappedCount: Object.keys(ROLE_MAP).length - missing.length, missing };
}

async function main() {
  const raw = JSON.parse(await fs.readFile(FIGMA_EXPORT_FILE, 'utf8'));
  const figmaColors = extractFigmaColors(raw);

  if (figmaColors.size === 0) {
    throw new Error(`No colors found in ${path.relative(REPO_ROOT, FIGMA_EXPORT_FILE)}`);
  }

  const primitiveCount = await syncBasePrimitives(figmaColors);
  const { mappedCount, missing } = await syncSemanticLayer(figmaColors);

  console.log(
    `Synced ${primitiveCount} colors -> tokens/base/color.json (color.gennius.*), ` +
      `${mappedCount}/${Object.keys(ROLE_MAP).length} semantic roles -> tokens/brands/gennius/semantic.light.json`,
  );

  if (missing.length > 0) {
    console.warn(`WARN: ROLE_MAP entries with no matching Figma name (skipped):\n  ${missing.join('\n  ')}`);
  }

  const usedNames = new Set(Object.values(ROLE_MAP));
  const unused = [...figmaColors.keys()].filter((name) => !usedNames.has(name));
  if (unused.length > 0) {
    console.log(
      `Colors present as primitives but not used by any semantic role yet: ${unused.join(', ')}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

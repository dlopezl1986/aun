// Verifies that every static i18n key referenced in src/ exists in the
// Spanish (source) catalogue. `en` is enforced by TypeScript.
// Usage: npm run check:i18n
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../src/', import.meta.url));
const esSource = readFileSync(join(root, 'i18n/locales/es.ts'), 'utf8')
  .replace(/\/\*\*[\s\S]*?\*\//g, '')
  .replace('export const es =', 'return')
  .replace(/export type[^\n]*\n/g, '');
const es = new Function(esSource)();

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|mjs)$/.test(f) ? [p] : [];
  });
}

const has = (key) => {
  const parts = key.split('.');
  const last = parts.pop();
  let node = es;
  for (const p of parts) node = node?.[p];
  if (!node) return false;
  return typeof node[last] === 'string' || typeof node[`${last}_one`] === 'string';
};

const patterns = [/\bt\(\s*'([^'$]+)'/g, /\b\w*Key:\s*'([^']+)'/g, /reasonKey(?:\s*[:?]\s*|\s*\?\?\s*)'([^']+)'/g];
const missing = new Set();
let count = 0;
for (const file of walk(root)) {
  if (file.includes('/i18n/locales/')) continue;
  const src = readFileSync(file, 'utf8');
  for (const re of patterns) {
    for (const m of src.matchAll(re)) {
      if (!m[1].includes('.')) continue;
      count += 1;
      if (!has(m[1])) missing.add(`${m[1]}  (${file.replace(root, 'src/')})`);
    }
  }
}
if (missing.size) {
  console.error(`✗ ${missing.size} missing i18n key(s):\n  ${[...missing].join('\n  ')}`);
  process.exit(1);
}
console.log(`✓ ${count} i18n key references verified.`);

import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve('.');
const DEMO_SOURCE_ROOTS = [
  'app/demo',
  'components/demo',
  'components/lab',
  'lib/demo',
] as const;

const FORBIDDEN = [
  { label: 'Supabase application code', pattern: /(?:@\/lib\/supabase|@supabase\/)/ },
  { label: 'owner data hooks', pattern: /@\/lib\/hooks/ },
  { label: 'network fetch', pattern: /\bfetch\s*\(/ },
  { label: 'application API route', pattern: /["'`]\/api(?:\/|["'`])/ },
  { label: 'database client creation', pattern: /\bcreateClient\s*\(/ },
] as const;

function productionSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return productionSources(path);
    if (!['.ts', '.tsx'].includes(extname(entry.name)) || entry.name.includes('.test.')) return [];
    return [path];
  });
}

describe('guest demo source boundary', () => {
  it('has no path to owner hooks, Supabase, or application APIs', () => {
    const violations = DEMO_SOURCE_ROOTS
      .flatMap((directory) => productionSources(resolve(ROOT, directory)))
      .flatMap((file) => {
        const source = readFileSync(file, 'utf8');
        return FORBIDDEN.flatMap(({ label, pattern }) => pattern.test(source)
          ? [`${relative(ROOT, file)}: ${label}`]
          : []);
      });

    expect(violations).toEqual([]);
  });
});

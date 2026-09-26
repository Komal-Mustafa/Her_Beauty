import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// "@hb/auth/client" is bundled into the browser. Walk its import graph (value imports only;
// `import type` is erased) and make sure it never reaches a server-only module.
const SRC = dirname(fileURLToPath(import.meta.url));
const CLIENT = join(SRC, 'client');
const SERVER_ONLY_FILES = ['index.ts', 'core.ts', 'qr.ts', 'cookies.ts', 'state-cookies.ts'].map(
  (f) => join(SRC, f),
);
const SERVER_ONLY_PACKAGES = new Set([
  'server-only',
  'next/headers',
  'qrcode',
  '@hb/auth',
  '@hb/auth/middleware',
]);
const isServerOnlyPackage = (spec: string) =>
  SERVER_ONLY_PACKAGES.has(spec) || spec.startsWith('node:');

function valueImports(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  const specs: string[] = [];
  for (const m of text.matchAll(/^\s*(import|export)\s+(?!type\b)[^'"]*?from\s+'([^']+)'/gm)) {
    if (m[2]) specs.push(m[2]);
  }
  for (const m of text.matchAll(/^\s*import\s+'([^']+)'/gm)) if (m[1]) specs.push(m[1]);
  return specs;
}

function resolveLocal(from: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = resolve(dirname(from), spec);
  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    try {
      readFileSync(candidate);
      return candidate;
    } catch {
      // try the next extension
    }
  }
  throw new Error(`cannot resolve ${spec} from ${from}`);
}

describe('@hb/auth/client', () => {
  it('never imports server-only code', () => {
    const seen = new Set<string>();
    const queue = readdirSync(CLIENT)
      .filter((f) => !f.includes('.test.'))
      .map((f) => join(CLIENT, f));
    const offenders: string[] = [];
    while (queue.length) {
      const file = queue.pop() as string;
      if (seen.has(file)) continue;
      seen.add(file);
      for (const spec of valueImports(file)) {
        if (isServerOnlyPackage(spec)) offenders.push(`${file} → ${spec}`);
        const local = resolveLocal(file, spec);
        if (!local) continue;
        if (SERVER_ONLY_FILES.includes(local)) offenders.push(`${file} → ${spec}`);
        queue.push(local);
      }
    }
    expect(offenders).toEqual([]);
    expect(seen.size).toBeGreaterThan(5);
  });
});

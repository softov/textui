#!/usr/bin/env node
/**
 * Every publishable package agrees with the tag.
 *
 * The packages release as a set - `workspace:^` between them means a mixed
 * set is a set that resolves to versions nobody tested together. Called with
 * the tag minus its leading `v`.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const expected = process.argv[2];
if (!expected) {
  console.error('usage: check-version.mjs <version>');
  process.exit(2);
}

const pkgDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'packages');
const problems = [];
let checked = 0;

for (const name of readdirSync(pkgDir).sort()) {
  const manifest = join(pkgDir, name, 'package.json');
  if (!existsSync(manifest)) continue;
  const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
  if (pkg.private) continue;
  checked++;
  if (pkg.version !== expected)
    problems.push(`${pkg.name} is ${pkg.version}, tag says ${expected}`);
}

for (const p of problems) console.error(`  ${p}`);
console.log(`${checked} publishable packages at ${expected}, ${problems.length} problems`);
process.exit(problems.length ? 1 : 0);

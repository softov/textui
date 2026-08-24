#!/usr/bin/env node
/**
 * Every `exports` and `bin` target in a publishable package has to exist in
 * the built tree.
 *
 * tsc cannot catch this. A subpath nothing in the repo imports is a promise
 * to consumers and to nobody else, so it compiles clean and fails on the
 * first `import ... from '@textui/core/hooks'` after publish. Run it against
 * a built tree - it reads dist, it does not build it.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkgDir = join(root, 'packages');

let checked = 0;
let skipped = 0;
const problems = [];

for (const name of readdirSync(pkgDir).sort()) {
  const dir = join(pkgDir, name);
  const manifest = join(dir, 'package.json');
  if (!existsSync(manifest)) continue;

  const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
  if (pkg.private) {
    skipped++;
    continue;
  }
  checked++;

  // `exports` nests conditions arbitrarily deep; `bin` is a string or a map.
  // Either way the leaves are the paths, so walk to the strings.
  const targets = [];
  const walk = (node, trail) => {
    if (typeof node === 'string') targets.push([node, trail]);
    else if (node && typeof node === 'object')
      for (const [k, v] of Object.entries(node)) walk(v, trail ? `${trail} ${k}` : k);
  };
  walk(pkg.exports, '');
  walk(pkg.bin, 'bin');

  for (const [target, trail] of targets) {
    if (!target.startsWith('.')) continue; // a bare specifier is a redirect, not a file
    if (!existsSync(join(dir, target)))
      problems.push(`${pkg.name}: ${trail || '.'} -> ${target} does not exist`);
  }

  // `files` decides the tarball. A target outside it resolves here and 404s
  // for the consumer, which is the same bug one step later.
  const files = pkg.files ?? [];
  for (const [target] of targets) {
    if (!target.startsWith('./')) continue;
    const top = target.slice(2).split('/')[0];
    if (!files.includes(top))
      problems.push(`${pkg.name}: ${target} is not covered by files[] (${files.join(', ')})`);
  }

  for (const required of ['README.md', 'LICENSE'])
    if (!existsSync(join(dir, required)))
      problems.push(`${pkg.name}: ${required} is missing`);
}

for (const p of problems) console.error(`  ${p}`);
console.log(
  `${checked} publishable packages checked, ${skipped} private, ${problems.length} problems`,
);
process.exit(problems.length ? 1 : 0);

#!/usr/bin/env node
import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { readdir, readFile, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The example runner.
 *
 * An example owns its application, so this script does not mount anything: it
 * bundles the example's own `main.tsx` and runs it. Bundling from the workspace
 * sources rather than from `dist` is what the playground does and for the same
 * reason - a runtime change shows up on the next run with no build in between.
 *
 * The list is the directory. There is no registry to fall out of sync with.
 */
const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');

async function examples() {
  const entries = await readdir(here, { withFileTypes: true });
  const found = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const manifest = JSON.parse(
        await readFile(resolve(here, entry.name, 'package.json'), 'utf8'),
      );
      found.push({ name: entry.name, description: manifest.description ?? '' });
    } catch {
      // A directory without a manifest is not an example.
    }
  }
  return found.sort((a, b) => a.name.localeCompare(b.name));
}

async function list() {
  const found = await examples();
  if (found.length === 0) {
    process.stdout.write('No examples yet. See examples/README.md for the layout.\n');
    return;
  }
  process.stdout.write('TextUI examples\n\n');
  const width = Math.max(...found.map((e) => e.name.length));
  for (const example of found) {
    process.stdout.write(`  ${example.name.padEnd(width)}  ${example.description}\n`);
  }
  process.stdout.write('\nRun one: pnpm example <name>\n');
}

const [name, ...rest] = process.argv.slice(2);

if (!name || name === '--list' || name === '-l') {
  await list();
  process.exit(0);
}

const root = resolve(here, name);
const found = await examples();
if (!found.some((e) => e.name === name)) {
  process.stderr.write(`No example called "${name}". Try --list.\n`);
  process.exit(1);
}

const outfile = resolve(root, '.dev/main.mjs');
await mkdir(dirname(outfile), { recursive: true });

await build({
  entryPoints: [resolve(root, 'src/main.tsx')],
  outfile,
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  sourcemap: 'inline',
  jsx: 'automatic',
  jsxImportSource: '@textui/core',
  logLevel: 'warning',
  alias: {
    '@textui/core/jsx-runtime': resolve(repo, 'packages/core/src/jsx/jsx-runtime.ts'),
    '@textui/core/jsx-dev-runtime': resolve(repo, 'packages/core/src/jsx/jsx-dev-runtime.ts'),
    '@textui/core': resolve(repo, 'packages/core/src/index.ts'),
    '@textui/terminal': resolve(repo, 'packages/terminal/src/index.ts'),
    '@textui/documents': resolve(repo, 'packages/documents/src/index.ts'),
  },
});

const child = spawn(process.execPath, [outfile, ...rest], { stdio: 'inherit' });
child.on('exit', async (code) => {
  await rm(dirname(outfile), { recursive: true, force: true });
  process.exit(code ?? 0);
});

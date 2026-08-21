#!/usr/bin/env node
import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The playground runner.
 *
 * Node can strip TypeScript types but not JSX, so the playground is bundled
 * before it runs. Bundling from source rather than from `dist` is deliberate:
 * a change to the runtime shows up here on the next run without a build step
 * in between, which is the whole point of having a playground.
 */
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const repo = resolve(root, '..');
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
  // Resolve the workspace packages to their sources.
  alias: {
    '@textui/core/jsx-runtime': resolve(repo, 'packages/core/src/jsx/jsx-runtime.ts'),
    '@textui/core/jsx-dev-runtime': resolve(repo, 'packages/core/src/jsx/jsx-dev-runtime.ts'),
    '@textui/core': resolve(repo, 'packages/core/src/index.ts'),
    '@textui/terminal': resolve(repo, 'packages/terminal/src/index.ts'),
    '@textui/documents': resolve(repo, 'packages/documents/src/index.ts'),
  },
});

const child = spawn(process.execPath, [outfile, ...process.argv.slice(2)], {
  stdio: 'inherit',
});

child.on('exit', async (code) => {
  await rm(dirname(outfile), { recursive: true, force: true });
  process.exit(code ?? 0);
});

#!/usr/bin/env node
import { context } from 'esbuild';
import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The development runner.
 *
 * Node can strip TypeScript types but not JSX, so the app is bundled before it
 * runs. Bundling from the workspace sources rather than from `dist` is
 * deliberate: textide is where the library gets used in anger, so a change to
 * the runtime has to show up here on the next run with no build in between.
 *
 * `--watch` goes one further and rebuilds while it runs. That is why this
 * produces four files instead of one.
 *
 * A hot reload has to re-register textide's components into the application
 * that is already running, which means the new module and the running one have
 * to be holding the *same* runtime: a `defineComponent` from a second copy of
 * `@textui/core` builds components whose hooks read a `currentInstance` that
 * the first copy's renderer never sets, and every one of them throws on its
 * first render. So the runtime is bundled once, to its own file, and both the
 * host and the reloadable screen import it by URL - which is what makes them
 * the same module object rather than two identical ones.
 *
 * What follows is that a change under `packages/core` is not hot reloaded; it
 * needs the process restarted. A change under `packages/textide` is, which is
 * the loop this exists for.
 *
 * The published `textide` binary runs `dist/main.js` instead - see `bin`.
 */
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const repo = resolve(root, '..', '..');
const out = resolve(root, '.dev');

const argv = process.argv.slice(2);
const watch = argv.includes('--watch');
// Build the bundles and stop. For CI, and for looking at what the split
// actually produced without a terminal to run it in.
const buildOnly = argv.includes('--build-only');
const args = argv.filter((a) => a !== '--watch' && a !== '--build-only');

await mkdir(out, { recursive: true });

/**
 * The workspace packages, and the file each one is bundled to.
 *
 * `textide-git` is in here for the same reason the runtime is: it is loaded at
 * runtime by specifier, and a bare `import('@textui/textide-git')` resolves
 * through `node_modules` to its built `dist` - which imports `@textui/core`
 * the same way and ends up holding a *second* copy of the runtime. Its
 * components' hooks then read a `currentInstance` this process's renderer
 * never sets, and every one of them throws on its first render. Bundling it
 * here makes it import `./core.mjs` like everything else.
 */
const RUNTIME = {
  '@textui/core': 'core.mjs',
  '@textui/terminal': 'terminal.mjs',
  '@textui/documents': 'documents.mjs',
  '@textui/textide-git': 'textide-git.mjs',
};

const SOURCE = {
  '@textui/core': resolve(repo, 'packages/core/src/index.ts'),
  '@textui/terminal': resolve(repo, 'packages/terminal/src/index.ts'),
  '@textui/documents': resolve(repo, 'packages/documents/src/index.ts'),
  '@textui/textide-git': resolve(repo, 'packages/textide-git/src/index.ts'),
};

/**
 * Which specifiers the host should import from beside itself.
 *
 * Written out rather than inferred from a file name: the host is told what was
 * bundled, instead of guessing that a package called `@textui/textide-git`
 * might have become a file called `textide-git.mjs`.
 */
const BUNDLED = { '@textui/textide-git': './textide-git.mjs' };

/**
 * Keep the runtime out of a bundle, and point at the one file it lives in.
 *
 * `external` alone would leave `@textui/core` as a bare specifier that Node
 * then resolves through `node_modules` to the *built* package - which is the
 * stale `dist` this runner exists to avoid.
 */
function shared(except) {
  return {
    name: 'shared-runtime',
    setup(build) {
      for (const [name, file] of Object.entries(RUNTIME)) {
        if (name === except) continue;
        const filter = new RegExp(`^${name}$`);
        build.onResolve({ filter }, () => ({ path: `./${file}`, external: true }));
      }
    },
  };
}

const common = {
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
  },
};

/** The runtime, one file per package, each importing the others by URL. */
const runtimes = await Promise.all(Object.entries(RUNTIME).map(([name, file]) =>
  context({
    ...common,
    entryPoints: [SOURCE[name]],
    outfile: resolve(out, file),
    plugins: [shared(name)],
  })));

/**
 * Everything textide registers, in the file a reload re-imports.
 *
 * It is `register.ts` rather than `main.tsx` because a reload replaces what is
 * *in* the application, not the application: the terminal stays acquired, the
 * store keeps every buffer, and `registerTextide` is the one call that puts
 * textide into an app and the one bag that takes it back out.
 */
const screen = await context({
  ...common,
  entryPoints: [resolve(root, 'src/register.ts')],
  outfile: resolve(out, 'screen.mjs'),
  plugins: [shared()],
});

const host = await context({
  ...common,
  entryPoints: [resolve(root, 'src/main.tsx')],
  outfile: resolve(out, 'main.mjs'),
  plugins: [
    shared(),
    {
      name: 'reloadable-screen',
      setup(build) {
        // The host imports the screen by URL too, so the module a reload
        // re-imports and the one that booted are the same file.
        build.onResolve({ filter: /^\.\/register\.js$/ }, () => ({ path: './screen.mjs', external: true }));
      },
    },
  ],
});

const all = [...runtimes, screen, host];
async function buildAll() {
  await Promise.all(all.map((c) => c.rebuild()));
}

await buildAll();
await writeFile(resolve(out, 'bundled.json'), `${JSON.stringify(BUNDLED, null, 2)}\n`);

if (buildOnly) {
  await Promise.all(all.map((c) => c.dispose()));
  process.stdout.write(`textide: built ${out}\n`);
  process.exit(0);
}

const child = spawn(process.execPath, [resolve(out, 'main.mjs'), ...args], {
  stdio: 'inherit',
  env: watch ? { ...process.env, TEXTIDE_RELOAD: '1' } : process.env,
});

/**
 * Rebuild, then ask the child to swap.
 *
 * The signal carries nothing: what changed is on disk, and the child decides
 * whether to take it. A rebuild that fails never reaches the signal, so the
 * running editor is left alone - which is the one thing a reload must not get
 * wrong.
 */
let pending = null;
if (watch) {
  const { watch: watchFs } = await import('node:fs');
  const debounce = () => {
    if (pending) clearTimeout(pending);
    pending = setTimeout(async () => {
      try {
        await buildAll();
        child.kill('SIGUSR2');
      } catch (error) {
        process.stderr.write(`textide: rebuild failed\n${String(error)}\n`);
      }
    }, 80);
  };
  // textide's own sources only. Everything else is in the runtime files, and
  // the running process is holding those - rebuilding one writes a file
  // nothing re-imports, which looks like a reload that silently did nothing.
  watchFs(resolve(root, 'src'), { recursive: true }, debounce);
}

child.on('exit', async (code) => {
  if (pending) clearTimeout(pending);
  await Promise.all(all.map((c) => c.dispose()));
  await rm(out, { recursive: true, force: true });
  process.exit(code ?? 0);
});

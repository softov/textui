import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * What the development runner produces.
 *
 * The shape of the output is the thing that matters, and it is invisible from
 * inside the running editor: everything holds one copy of the runtime, or the
 * components a second copy defines throw on their first render because their
 * hooks read a `currentInstance` this renderer never sets.
 *
 * That failure is silent in exactly the wrong way - the editor opens, and the
 * one part that came from the second copy is missing - so it is asserted here
 * rather than left to be noticed.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, '.dev');

describe('the dev bundle', () => {
  it('gives every part the same runtime, extensions included', async () => {
    execFileSync(process.execPath, [join(root, 'scripts/dev.mjs'), '--build-only'], {
      cwd: root, stdio: 'pipe',
    });

    const git = await readFile(join(out, 'textide-git.mjs'), 'utf8');
    // Imported, not inlined. A bundle that carried its own core would contain
    // the runtime's source instead of a line pointing at it.
    expect(git).toContain('from "./core.mjs"');
    expect(git).not.toContain('function createApp(');

    const screen = await readFile(join(out, 'screen.mjs'), 'utf8');
    expect(screen).toContain('from "./core.mjs"');
  }, 60_000);

  it('writes down what it bundled, so the host can prefer it', async () => {
    const map = JSON.parse(await readFile(join(out, 'bundled.json'), 'utf8')) as
      Record<string, string>;
    // Written out rather than inferred from a file name: the host is told what
    // was bundled instead of guessing that a package called
    // `@textui/textide-git` became a file called `textide-git.mjs`.
    expect(map['@textui/textide-git']).toBe('./textide-git.mjs');
  });
});

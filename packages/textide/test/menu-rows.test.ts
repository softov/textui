import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderApp } from '@textui/testing';
import { loadWorkspace, registerTextide } from '../src/index.js';
import { rowsFor } from '../src/chrome/menubar.js';

/**
 * View > Open With, which is the one menu row whose choices are async.
 *
 * `panel.openWith` has to `stat` the resource before it can say what can open
 * it, so its `choices` is an async function. The menu bar kept its own copy of
 * "does this command ask something?" that answered by *calling* that function
 * and mapping over the result - so it mapped over a promise, and opening the
 * row reported a type error against the keystroke.
 *
 * Whether a command will ask is a property of its declaration. Nothing has to
 * be resolved to know it, which is why both places use the palette's rule now.
 */

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'textide-openwith-'));
  await writeFile(join(dir, 'a.md'), '# a\n');
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

const SIZES = [
  { width: 96, height: 22 },
  { width: 130, height: 34 },
] as const;

async function open(size: { width: number; height: number }) {
  const workspace = await loadWorkspace(dir);
  const t = await renderApp({
    width: size.width,
    height: size.height,
    shell: 'workbench',
    theme: 'workbench',
    onBoot: (app) => registerTextide(app, { workspace }),
  });
  const quiet = async (): Promise<void> => {
    for (let i = 0; i < 10; i++) { await t.settle(); t.advance(50); t.flush(); }
  };
  await quiet();
  return { t, quiet };
}

/**
 * A menu row whose command resolves its choices asynchronously.
 *
 * `panel.openWith` has to `stat` the resource before it can say what can open
 * it. It is not in a menu any more - the View menu was reorganised and it
 * lives in the palette and the file actions now - so the row is built here
 * from an explicit spec, which is the thing that broke and the thing that
 * would break again for the next command like it.
 */
describe('rowsFor, on a command with async choices', () => {
  const SPEC = { id: 'test', label: 'Test', items: ['panel.openWith'] };

  it('builds the row without resolving anything', async () => {
    const { t } = await open(SIZES[0]);
    // The failure was here: the old code *called* the choices function to
    // decide whether the command asks a question, then mapped the promise.
    const rows = rowsFor(t.app, SPEC);
    expect(rows.map((r) => r.item.label)).toEqual(['Open With…']);
    // And it knows the row asks something, so it draws a chevron.
    expect(rows[0]?.item.children).toEqual([]);
    await t.unmount();
  });

  it.each([true, false])('runs without throwing, with a file open: %s', async (withFile) => {
    const { t, quiet } = await open(SIZES[0]);
    if (withFile) {
      t.app.store.set('$/ui/editor/uri', `file://${join(dir, 'a.md')}`);
      await quiet();
    }

    rowsFor(t.app, SPEC)[0]?.run(t.app);
    await quiet();

    expect(t.errors(), 'no file open is a state, not a fault').toEqual([]);
    // A command with choices is asked in the palette, not in a submenu the
    // menu built for itself.
    expect(t.app.layers.entries().map((e) => e.id)).toContain('palette');
    await t.unmount();
  });
});

describe.each(SIZES)('a menu row by keyboard and by mouse at $width x $height', (size) => {
  it('opens a View row by keyboard without a type error', async () => {
    const { t, quiet } = await open(size);

    t.press('alt+v');
    await quiet();
    expect(t.hasText('Command Palette'), 'the menu is open').toBe(true);

    t.press('enter');
    await quiet();
    expect(t.errors()).toEqual([]);
    await t.unmount();
  });

  it('opens a View row by mouse without a type error', async () => {
    const { t, quiet } = await open(size);

    t.press('alt+v');
    await quiet();

    const row = t.lines().findIndex((line) => line.includes('Theme'));
    expect(row, 'the row is drawn somewhere').toBeGreaterThan(-1);
    const column = (t.lines()[row] as string).indexOf('Theme');
    t.click(column + 1, row);
    await quiet();

    expect(t.errors()).toEqual([]);
    await t.unmount();
  });
});

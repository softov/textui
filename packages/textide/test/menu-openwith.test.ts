import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderApp } from '@textui/testing';
import { loadWorkspace, registerTextide } from '../src/index.js';

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

describe.each(SIZES)('View > Open With at $width x $height', (size) => {
  it('opens by keyboard with nothing selected, and says nothing about types', async () => {
    const { t, quiet } = await open(size);

    t.press('alt+v');
    await quiet();
    expect(t.hasText('Open With'), 'the row is there').toBe(true);

    // First row of the View menu.
    t.press('enter');
    await quiet();

    expect(t.errors(), 'no file open is a state, not a fault').toEqual([]);
    await t.unmount();
  });

  it('opens by mouse with nothing selected', async () => {
    const { t, quiet } = await open(size);

    t.press('alt+v');
    await quiet();

    const row = t.lines().findIndex((line) => line.includes('Open With'));
    expect(row, 'the row is drawn somewhere').toBeGreaterThan(-1);
    const column = (t.lines()[row] as string).indexOf('Open With');
    t.click(column + 1, row);
    await quiet();

    expect(t.errors()).toEqual([]);
    await t.unmount();
  });

  it('still hands off to the palette when a file is open', async () => {
    const { t, quiet } = await open(size);
    t.app.store.set('$/ui/editor/uri', `file://${join(dir, 'a.md')}`);
    await quiet();

    t.press('alt+v');
    await quiet();
    t.press('enter');
    await quiet();

    expect(t.errors()).toEqual([]);
    // The palette is where a command with choices gets asked - the menu does
    // not build a submenu of its own.
    expect(t.app.layers.entries().map((e) => e.id)).toContain('palette');
    await t.unmount();
  });
});

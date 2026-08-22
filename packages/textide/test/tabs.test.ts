import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderApp } from '@textui/testing';
import { loadWorkspace, registerTextide } from '../src/index.js';
import { EDITOR_URI, SPLIT_PATH, TABS_PATH } from '../src/tabs.js';

/**
 * Tabs and splits.
 *
 * The model is a list of URIs and a pointer into it, so everything here is
 * about the list agreeing with the pointer: opening a second file does not
 * lose the first, closing one lands somewhere, and a second pane is a second
 * URI rather than a second copy of anything.
 *
 * Both sizes, because the strip is the row most likely to be the one that
 * stops fitting.
 */

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'textide-tabs-'));
  await writeFile(join(dir, 'alpha.txt'), 'alpha one\nalpha two\n');
  await writeFile(join(dir, 'beta.txt'), 'beta one\nbeta two\n');
  await writeFile(join(dir, 'gamma.txt'), 'gamma one\n');
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

interface Size { width: number; height: number }
const SIZES: Size[] = [
  { width: 96, height: 20 },
  { width: 140, height: 44 },
];
const label = (s: Size): string => `${s.width}x${s.height}`;

async function open(size: Size) {
  const workspace = await loadWorkspace(dir);
  const t = await renderApp({
    width: size.width, height: size.height, shell: 'workbench', theme: 'workbench',
    onBoot: (app) => registerTextide(app, { workspace }),
  });
  const quiet = async (): Promise<void> => {
    for (let i = 0; i < 12; i++) { await t.settle(); t.advance(50); t.flush(); }
  };
  await quiet();
  const uri = (name: string): string => `file://${join(dir, name)}`;
  return { t, quiet, uri };
}

describe('the strip', () => {
  for (const size of SIZES) {
    it(`opens a second file without losing the first, at ${label(size)}`, async () => {
      const { t, quiet, uri } = await open(size);
      t.app.store.set(EDITOR_URI, uri('alpha.txt'));
      await quiet();
      t.app.store.set(EDITOR_URI, uri('beta.txt'));
      await quiet();

      expect(t.app.store.get(TABS_PATH)).toEqual([uri('alpha.txt'), uri('beta.txt')]);
      expect(t.hasText('alpha.txt'), 'the strip names the one you left').toBe(true);
      expect(t.hasText('beta one'), 'and shows the one you are on').toBe(true);
      await t.unmount();
    });
  }

  /**
   * The pointer is the thing anything else writes, so the strip follows it.
   * Otherwise "open a file" has two implementations, and the one a test or an
   * extension uses is the one that leaves no tab behind.
   */
  it('grows a tab for a URI nothing asked it about', async () => {
    const { t, quiet, uri } = await open(SIZES[0]!);
    t.app.store.set(EDITOR_URI, uri('gamma.txt'));
    await quiet();
    expect(t.app.store.get(TABS_PATH)).toEqual([uri('gamma.txt')]);
    await t.unmount();
  });

  it('draws no strip for one file', async () => {
    const { t, quiet, uri } = await open(SIZES[0]!);
    t.app.store.set(EDITOR_URI, uri('alpha.txt'));
    await quiet();
    // The name is in the titlebar either way; what must not be there is a row
    // of one tab, which is a row that only costs a line.
    expect(t.queryByRole('tablist')).toBe(null);
    await t.unmount();
  });

  it('walks the strip with ctrl+pageup and ctrl+pagedown', async () => {
    const { t, quiet, uri } = await open(SIZES[0]!);
    t.app.store.set(EDITOR_URI, uri('alpha.txt'));
    await quiet();
    t.app.store.set(EDITOR_URI, uri('beta.txt'));
    await quiet();

    t.press('ctrl+pageup');
    await quiet();
    expect(t.app.store.get(EDITOR_URI)).toBe(uri('alpha.txt'));

    t.press('ctrl+pagedown');
    await quiet();
    expect(t.app.store.get(EDITOR_URI)).toBe(uri('beta.txt'));
    await t.unmount();
  });

  it('lands on the neighbour when a tab closes, not on the first', async () => {
    const { t, quiet, uri } = await open(SIZES[0]!);
    for (const name of ['alpha.txt', 'beta.txt', 'gamma.txt']) {
      t.app.store.set(EDITOR_URI, uri(name));
      await quiet();
    }
    t.app.store.set(EDITOR_URI, uri('beta.txt'));
    await quiet();

    t.app.execute('file.close');
    await quiet();
    expect(t.app.store.get(TABS_PATH)).toEqual([uri('alpha.txt'), uri('gamma.txt')]);
    expect(t.app.store.get(EDITOR_URI)).toBe(uri('gamma.txt'));
    await t.unmount();
  });

  it('empties the pane when the last tab closes', async () => {
    const { t, quiet, uri } = await open(SIZES[0]!);
    t.app.store.set(EDITOR_URI, uri('alpha.txt'));
    await quiet();
    t.app.execute('file.close');
    await quiet();
    expect(t.app.store.get(TABS_PATH)).toEqual([]);
    expect(t.app.store.get(EDITOR_URI)).toBe(null);
    await t.unmount();
  });

  it('refuses to close a file with unsaved changes', async () => {
    const { t, quiet, uri } = await open(SIZES[0]!);
    t.app.store.set(EDITOR_URI, uri('alpha.txt'));
    await quiet();
    t.app.execute('file.edit');
    await quiet();
    t.type('!');
    await quiet();

    t.app.execute('file.close');
    await quiet();
    expect(t.app.store.get(TABS_PATH)).toEqual([uri('alpha.txt')]);
    await t.unmount();
  });
});

describe('the split', () => {
  for (const size of SIZES) {
    it(`shows two files at once, at ${label(size)}`, async () => {
      const { t, quiet, uri } = await open(size);
      t.app.store.set(EDITOR_URI, uri('alpha.txt'));
      await quiet();
      t.app.store.set(EDITOR_URI, uri('beta.txt'));
      await quiet();

      t.app.execute('view.split');
      await quiet();
      expect(t.app.store.get(SPLIT_PATH)).toBe(uri('alpha.txt'));
      expect(t.hasText('beta one')).toBe(true);
      expect(t.hasText('alpha one')).toBe(true);
      await t.unmount();
    });
  }

  /**
   * Two panes on one file is the point of the buffer being the document: the
   * split has nothing of its own to lose, so it costs nothing to open on a
   * file too long to see at once.
   */
  it('pins the same file when there is no other one open', async () => {
    const { t, quiet, uri } = await open(SIZES[0]!);
    t.app.store.set(EDITOR_URI, uri('alpha.txt'));
    await quiet();
    t.app.execute('view.split');
    await quiet();
    expect(t.app.store.get(SPLIT_PATH)).toBe(uri('alpha.txt'));
    await t.unmount();
  });

  it('goes back to one pane on the second call', async () => {
    const { t, quiet, uri } = await open(SIZES[0]!);
    t.app.store.set(EDITOR_URI, uri('alpha.txt'));
    await quiet();
    t.app.execute('view.split');
    await quiet();
    t.app.execute('view.split');
    await quiet();
    expect(t.app.store.get(SPLIT_PATH)).toBe(null);
    await t.unmount();
  });

  it('closes the split rather than leaving it on a file nobody has open', async () => {
    const { t, quiet, uri } = await open(SIZES[0]!);
    t.app.store.set(EDITOR_URI, uri('alpha.txt'));
    await quiet();
    t.app.store.set(EDITOR_URI, uri('beta.txt'));
    await quiet();
    t.app.execute('view.split');
    await quiet();
    expect(t.app.store.get(SPLIT_PATH)).toBe(uri('alpha.txt'));

    t.app.store.set(EDITOR_URI, uri('alpha.txt'));
    await quiet();
    t.app.execute('file.close');
    await quiet();
    expect(t.app.store.get(SPLIT_PATH)).toBe(null);
    await t.unmount();
  });

  /**
   * One caret claims focus when edit mode is entered. Two panes both claiming
   * it is a race whose winner is whichever happened to render first.
   */
  it('puts the caret in the primary pane, not in whichever drew first', async () => {
    const { t, quiet, uri } = await open(SIZES[0]!);
    t.app.store.set(EDITOR_URI, uri('alpha.txt'));
    await quiet();
    t.app.execute('view.split');
    await quiet();
    t.app.execute('file.edit');
    await quiet();
    expect(t.app.focus.focused()).toBe(t.app.focus.order('pane.main')[0]);
    await t.unmount();
  });
});

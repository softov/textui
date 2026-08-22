import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderApp } from '@textui/testing';
import { getDocument } from '@textui/documents';
import { loadWorkspace, registerTextide } from '../src/index.js';
import {
  EDITOR_URI, GROUP_PATH, LAYOUT_PATH, allTabs, readGroups,
} from '../src/tabs.js';

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

/** The open files of the group the keyboard is in. */
function tabsOf(t: { app: { store: Parameters<typeof readGroups>[0] } }): string[] {
  return readGroups(t.app.store)[
    Math.max(0, Math.min(
      (t.app.store.get<number>(GROUP_PATH) ?? 0),
      readGroups(t.app.store).length - 1,
    ))
  ]?.tabs ?? [];
}

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

      expect(tabsOf(t)).toEqual([uri('alpha.txt'), uri('beta.txt')]);
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
    expect(tabsOf(t)).toEqual([uri('gamma.txt')]);
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
    expect(tabsOf(t)).toEqual([uri('alpha.txt'), uri('gamma.txt')]);
    expect(t.app.store.get(EDITOR_URI)).toBe(uri('gamma.txt'));
    await t.unmount();
  });

  it('empties the pane when the last tab closes', async () => {
    const { t, quiet, uri } = await open(SIZES[0]!);
    t.app.store.set(EDITOR_URI, uri('alpha.txt'));
    await quiet();
    t.app.execute('file.close');
    await quiet();
    expect(tabsOf(t)).toEqual([]);
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
    expect(tabsOf(t)).toEqual([uri('alpha.txt')]);
    await t.unmount();
  });
});

/**
 * Groups.
 *
 * A group is a strip of tabs and which of them is showing. One group looks
 * like a tab bar; two groups is a split, and each half keeps its own strip -
 * because a split whose halves share one strip is two panes showing whatever
 * the last click did, rather than two places to be.
 */
describe('the split', () => {
  for (const size of SIZES) {
    it(`gives each half its own strip, at ${label(size)}`, async () => {
      const { t, quiet, uri } = await open(size);
      for (const name of ['alpha.txt', 'beta.txt']) {
        t.app.store.set(EDITOR_URI, uri(name));
        await quiet();
      }

      t.app.execute('view.split');
      await quiet();
      t.app.layers.closeLayer('notification');
      await quiet();

      const groups = readGroups(t.app.store);
      expect(groups).toHaveLength(2);
      expect(groups[0]?.tabs, 'the file you split off left the first group')
        .toEqual([uri('alpha.txt')]);
      expect(groups[1]?.tabs).toEqual([uri('beta.txt')]);
      expect(t.app.store.get(GROUP_PATH), 'and the keyboard went with it').toBe(1);

      expect(t.hasText('alpha one')).toBe(true);
      expect(t.hasText('beta one')).toBe(true);
      // Two strips, not one: each half says what it is showing.
      expect(t.getAllByRole('tablist')).toHaveLength(2);
      await t.unmount();
    });
  }

  /**
   * Two panes on one file is the point of the buffer being the document: the
   * split has nothing of its own to lose, so it costs nothing to open on a
   * file too long to see at once.
   */
  it('shows the same file twice when there is only one open', async () => {
    const { t, quiet, uri } = await open(SIZES[0]!);
    t.app.store.set(EDITOR_URI, uri('alpha.txt'));
    await quiet();
    t.app.execute('view.split');
    await quiet();

    const groups = readGroups(t.app.store);
    expect(groups.map((g) => g.active)).toEqual([uri('alpha.txt'), uri('alpha.txt')]);
    await t.unmount();
  });

  it('goes back to one group on the second call, keeping every file', async () => {
    const { t, quiet, uri } = await open(SIZES[0]!);
    for (const name of ['alpha.txt', 'beta.txt', 'gamma.txt']) {
      t.app.store.set(EDITOR_URI, uri(name));
      await quiet();
    }
    t.app.execute('view.split');
    await quiet();
    t.app.execute('view.split');
    await quiet();

    expect(readGroups(t.app.store)).toHaveLength(1);
    expect(allTabs(t.app.store), 'nothing was closed by merging')
      .toEqual([uri('alpha.txt'), uri('beta.txt'), uri('gamma.txt')]);
    await t.unmount();
  });

  it('arranges the groups as a row or a column', async () => {
    const { t, quiet, uri } = await open(SIZES[1]!);
    for (const name of ['alpha.txt', 'beta.txt']) {
      t.app.store.set(EDITOR_URI, uri(name));
      await quiet();
    }

    // Choosing an arrangement that needs two groups is also how a split opens.
    t.app.execute('view.editorLayout', { layout: 'stack' });
    await quiet();
    expect(t.app.store.get(LAYOUT_PATH)).toBe('stack');
    expect(readGroups(t.app.store)).toHaveLength(2);
    const stacked = t.lines().findIndex((line) => line.includes('alpha one'));
    const stackedBelow = t.lines().findIndex((line) => line.includes('beta one'));
    expect(stacked, 'one above the other').not.toBe(stackedBelow);

    t.app.execute('view.editorLayout', { layout: 'split' });
    await quiet();
    expect(t.app.store.get(LAYOUT_PATH)).toBe('split');
    // Side by side is one row carrying both.
    expect(t.lines().some((line) => line.includes('alpha one') && line.includes('beta one')))
      .toBe(true);

    t.app.execute('view.editorLayout', { layout: 'tabs' });
    await quiet();
    expect(readGroups(t.app.store), 'tabs is one group by definition').toHaveLength(1);
    await t.unmount();
  });

  it('moves the keyboard between the groups with f6', async () => {
    const { t, quiet, uri } = await open(SIZES[0]!);
    for (const name of ['alpha.txt', 'beta.txt']) {
      t.app.store.set(EDITOR_URI, uri(name));
      await quiet();
    }
    t.app.execute('view.split');
    await quiet();
    expect(t.app.store.get(EDITOR_URI)).toBe(uri('beta.txt'));

    t.press('f6');
    await quiet();
    expect(t.app.store.get(GROUP_PATH)).toBe(0);
    expect(t.app.store.get(EDITOR_URI), 'and the open file follows it')
      .toBe(uri('alpha.txt'));
    await t.unmount();
  });

  /**
   * A group with nothing in it is not a pane, it is a hole.
   */
  it('drops a group when its last tab closes', async () => {
    const { t, quiet, uri } = await open(SIZES[0]!);
    for (const name of ['alpha.txt', 'beta.txt']) {
      t.app.store.set(EDITOR_URI, uri(name));
      await quiet();
    }
    t.app.execute('view.split');
    await quiet();
    expect(readGroups(t.app.store)).toHaveLength(2);

    t.app.execute('file.close');
    await quiet();
    expect(readGroups(t.app.store)).toHaveLength(1);
    expect(allTabs(t.app.store)).toEqual([uri('alpha.txt')]);
    await t.unmount();
  });

  /**
   * A file the other group already has moves the keyboard there rather than
   * opening a second copy of it - two tabs on one file in two groups is a
   * split nobody can reason about.
   */
  it('goes to the group that already has the file', async () => {
    const { t, quiet, uri } = await open(SIZES[0]!);
    for (const name of ['alpha.txt', 'beta.txt']) {
      t.app.store.set(EDITOR_URI, uri(name));
      await quiet();
    }
    t.app.execute('view.split');
    await quiet();
    expect(t.app.store.get(GROUP_PATH)).toBe(1);

    t.app.store.set(EDITOR_URI, uri('alpha.txt'));
    await quiet();
    expect(t.app.store.get(GROUP_PATH), 'the group holding it took the keyboard').toBe(0);
    expect(readGroups(t.app.store).map((g) => g.tabs))
      .toEqual([[uri('alpha.txt')], [uri('beta.txt')]]);
    await t.unmount();
  });

  /**
   * One caret claims focus when edit mode is entered. Two panes both claiming
   * it is a race whose winner is whichever happened to render first.
   */
  it('puts the caret in the group the keyboard is in', async () => {
    const { t, quiet, uri } = await open(SIZES[0]!);
    t.app.store.set(EDITOR_URI, uri('alpha.txt'));
    await quiet();
    t.app.execute('view.split');
    await quiet();
    t.app.execute('file.edit');
    await quiet();
    expect(t.store.get('$/focus/scope')).toBe('pane.split');

    t.press('f6');
    await quiet();
    expect(t.store.get('$/focus/scope')).toBe('pane.main');
    await t.unmount();
  });
});

/**
 * Reaching a file without going to the strip.
 *
 * Tab leaves the strip and an arrow inside it changes the tab, which is what a
 * tab strip is - but both of those cost you the keyboard you were using. These
 * are chords instead, so they work from wherever focus happens to be and leave
 * it exactly where it was.
 */
describe('the keys that switch file', () => {
  async function editing() {
    const { t, quiet, uri } = await open(SIZES[0]!);
    for (const name of ['alpha.txt', 'beta.txt', 'gamma.txt']) {
      t.app.store.set(EDITOR_URI, uri(name));
      await quiet();
    }
    t.app.execute('file.edit');
    await quiet();
    expect(t.store.get('$/focus/scope'), 'the caret is in the pane').toBe('pane.main');
    return { t, quiet, uri };
  }

  it('walks the strip with alt and an arrow, without moving focus', async () => {
    const { t, quiet, uri } = await editing();
    t.press('alt+left');
    await quiet();
    expect(t.app.store.get(EDITOR_URI)).toBe(uri('beta.txt'));
    expect(t.store.get('$/focus/scope'), 'and the caret stayed put').toBe('pane.main');

    t.press('alt+right');
    await quiet();
    expect(t.app.store.get(EDITOR_URI)).toBe(uri('gamma.txt'));
    await t.unmount();
  });

  it('goes straight to one with alt and its number', async () => {
    const { t, quiet, uri } = await editing();
    t.press('alt+1');
    await quiet();
    expect(t.app.store.get(EDITOR_URI)).toBe(uri('alpha.txt'));

    t.press('alt+3');
    await quiet();
    expect(t.app.store.get(EDITOR_URI)).toBe(uri('gamma.txt'));
    await t.unmount();
  });

  /**
   * A key that always does something teaches you nothing about how many files
   * you have open, and `alt+7` quietly meaning `alt+3` is worse than `alt+7`
   * meaning nothing.
   */
  it('does nothing at all when there is no such file', async () => {
    const { t, quiet, uri } = await editing();
    t.press('alt+9');
    await quiet();
    expect(t.app.store.get(EDITOR_URI)).toBe(uri('gamma.txt'));
    await t.unmount();
  });

  /**
   * A terminal reports `alt+1` as an escape and a `1`, so an editor that only
   * checked ctrl and meta typed the digit and swallowed the chord.
   */
  it('does not type the digit into the file it just opened', async () => {
    const { t, quiet, uri } = await editing();
    t.pressAll('alt+1', 'alt+2', 'alt+3', 'alt+shift+?');
    await quiet();
    for (const name of ['alpha.txt', 'beta.txt', 'gamma.txt']) {
      expect(getDocument(t.app.store, uri(name))?.content ?? '', name)
        .not.toMatch(/[0-9?]/);
    }
    await t.unmount();
  });
});

/**
 * Moving the highlight is not opening anything.
 *
 * It was: `onSelect` opened whatever the highlight landed on, so rolling down
 * past a folder of fifteen files opened fifteen tabs and read fifteen files
 * off the disk. Moving through a tree is how you look *for* something.
 */
describe('the explorer', () => {
  it('opens nothing on the way past', async () => {
    const { t, quiet } = await open(SIZES[0]!);
    expect(t.app.focus.focused(), 'the tree has the keyboard').not.toBe(null);

    for (let i = 0; i < 6; i++) { t.press('down'); await quiet(); }
    expect(tabsOf(t) ?? [], 'nothing opened').toEqual([]);
    expect(t.app.store.get(EDITOR_URI) ?? null).toBe(null);
    await t.unmount();
  });

  it('opens the one you pressed enter on', async () => {
    // The tree starts on its first row, so this is the file already under the
    // highlight - which is the point: it took a keypress to open it.
    const { t, quiet, uri } = await open(SIZES[0]!);
    t.press('enter');
    await quiet();
    expect(tabsOf(t)).toEqual([uri('alpha.txt')]);

    t.press('down');
    t.press('enter');
    await quiet();
    expect(tabsOf(t)).toEqual([uri('alpha.txt'), uri('beta.txt')]);
    await t.unmount();
  });

  /**
   * The titlebar says which file is *open*. It used to read the tree's
   * highlight, which was the same thing only while moving opened files - and
   * its unsaved marker read a flag written `false` beside that highlight and
   * never written again, so it never once appeared.
   */
  it('names the open file in the titlebar, and marks it unsaved', async () => {
    const { t, quiet, uri } = await open(SIZES[0]!);
    t.app.store.set(EDITOR_URI, uri('alpha.txt'));
    await quiet();
    expect(t.lines()[1] ?? '', 'the titlebar').toContain('alpha.txt');

    t.app.execute('file.edit');
    await quiet();
    t.type('!');
    await quiet();
    expect(t.lines()[1] ?? '', 'and says it is unsaved').toContain('unsaved');
    await t.unmount();
  });
});

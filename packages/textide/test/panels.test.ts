import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderApp } from '@textui/testing';
import { panelViewPath } from '@textui/widgets';
import { loadWorkspace, registerTextide } from '../src/index.js';
import { EDITOR_URI, openTab } from '../src/tabs.js';

/**
 * A pane is a panel.
 *
 * Which is to say: a place a resource is shown, remembering where it was
 * looking, with the component that draws it chosen late. What that buys, and
 * what these tests are about, is that leaving a file and coming back is not
 * starting over - whether you left it by switching tabs or by switching what
 * is drawing it.
 */

let dir: string;

const LONG = Array.from({ length: 120 }, (_, i) => `line ${i + 1} of the document`).join('\n');

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'textide-panels-'));
  await writeFile(join(dir, 'long.txt'), `${LONG}\n`);
  await writeFile(join(dir, 'short.txt'), 'short one\nshort two\n');
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function open() {
  const workspace = await loadWorkspace(dir);
  const t = await renderApp({
    width: 100, height: 24, shell: 'workbench', theme: 'workbench',
    onBoot: (app) => registerTextide(app, { workspace }),
  });
  const quiet = async (): Promise<void> => {
    for (let i = 0; i < 12; i++) { await t.settle(); t.advance(50); t.flush(); }
  };
  await quiet();
  const uri = (name: string): string => `file://${join(dir, name)}`;
  return { t, quiet, uri };
}

describe('coming back to a file', () => {
  it('lands where it was left, not at the top', async () => {
    const { t, quiet, uri } = await open();
    openTab(t.app.store, uri('long.txt'));
    openTab(t.app.store, uri('short.txt'));
    t.app.store.set(EDITOR_URI, uri('long.txt'));
    await quiet();

    // Into the caret, then a long way down it.
    await t.app.execute('file.edit');
    await quiet();
    for (let i = 0; i < 30; i++) t.press('down');
    await quiet();
    const away = t.text();
    expect(t.hasText('line 1 of the document'), 'the top has scrolled off').toBe(false);

    t.app.store.set(EDITOR_URI, uri('short.txt'));
    await quiet();
    expect(t.hasText('short one')).toBe(true);

    t.app.store.set(EDITOR_URI, uri('long.txt'));
    await quiet();
    expect(t.text(), 'the same screen as when it was left').toBe(away);
    await t.unmount();
    // Thirty keypresses and three settles either side of two file switches;
    // the default five seconds is not much when the suite is also building a
    // bundle in another worker.
  }, 20_000);

  it('keeps the line when what is drawing it changes', async () => {
    const { t, quiet, uri } = await open();
    t.app.store.set(EDITOR_URI, uri('long.txt'));
    await quiet();
    await t.app.execute('file.edit');
    await quiet();

    for (let i = 0; i < 40; i++) t.press('down');
    await quiet();
    const line = t.store.get<{ state?: { line?: number } }>(
      panelViewPath('pane.main', uri('long.txt')),
    )?.state?.line;
    expect(line, 'the caret is in the panel record').toBeGreaterThan(20);

    // Out to the viewer and back to the caret. The record is shared by
    // renderers that measure in source lines, which is the whole reason
    // `ctrl+e` twice is not a trip to the top of the file.
    await t.app.execute('file.edit');
    await quiet();
    await t.app.execute('file.edit');
    await quiet();

    expect(t.store.get<{ state?: { line?: number } }>(
      panelViewPath('pane.main', uri('long.txt')),
    )?.state?.line).toBe(line);
    await t.unmount();
  }, 20_000);
});

describe('a split', () => {
  it('divides the pane in half, whatever is in each side', async () => {
    const { t, quiet, uri } = await open();
    // One side holds 40-column lines and the other holds nine, which is the
    // case that used to come out as a sliver beside a pane: `flex` shares out
    // what is *left* after content, so the wide side started wide.
    openTab(t.app.store, uri('long.txt'));
    openTab(t.app.store, uri('short.txt'));
    await quiet();
    await t.app.execute('view.split');
    await quiet();
    t.app.layers.closeLayer('notification');
    await quiet();

    const strips = t.getAllByRole('tablist');
    expect(strips).toHaveLength(2);
    const widths = strips.map((s) => s.rect?.width ?? 0);
    expect(widths[0]).toBeGreaterThan(10);
    expect(Math.abs((widths[0] ?? 0) - (widths[1] ?? 0)), 'the two halves match')
      .toBeLessThanOrEqual(1);
    await t.unmount();
  });
});

describe('how a file opens', () => {
  it('offers every renderer registered for the kind', async () => {
    const { t, quiet, uri } = await open();
    t.app.store.set(EDITOR_URI, uri('long.txt'));
    await quiet();

    const choices = await Promise.resolve(
      t.app.commands.get('panel.openWith')?.args?.[0]?.choices,
    );
    const list = typeof choices === 'function' ? await choices() : choices;
    // The editor and the plain viewer, from the filesystem adapter and the
    // documents catalog - two registrations this application never has to
    // list, because the registry already knows them.
    expect(list).toContain('Editor');
    expect(list).toContain('Plain text');
    await t.unmount();
  });

  it('is a choice that sticks to the file', async () => {
    const { t, quiet, uri } = await open();
    t.app.store.set(EDITOR_URI, uri('long.txt'));
    await quiet();

    await t.app.execute('panel.openWith', { renderer: 'Editor' });
    await quiet();
    expect(t.store.get<{ renderer?: string }>(
      panelViewPath('pane.main', uri('long.txt')),
    )?.renderer).toBe('textide.edit');
    expect(t.store.get('$/ui/editor/mode'), 'and the chrome agrees').toBe('edit');
    await t.unmount();
  });
});

/**
 * What can be done to this one.
 *
 * The registry already knows - the filesystem contributes rename and delete,
 * git contributes stage and diff, an extension contributes whatever it likes -
 * so the only thing that was missing was a way to ask.
 */
describe('the actions on a file', () => {
  it('opens on the row the tree is standing on', async () => {
    const { t, quiet, uri } = await open();
    t.app.store.set(EDITOR_URI, uri('long.txt'));
    await quiet();

    t.press('shift+f10');
    await quiet();
    expect(t.hasText('Rename')).toBe(true);
    expect(t.hasText('Delete')).toBe(true);

    t.press('escape');
    await quiet();
    expect(t.app.layers.entries('floating')).toHaveLength(0);
    await t.unmount();
  });

  it('opens on the same chord from inside the editor', async () => {
    const { t, quiet, uri } = await open();
    t.app.store.set(EDITOR_URI, uri('long.txt'));
    await quiet();
    await t.app.execute('file.edit');
    await quiet();

    // `alt+enter` has to reach the application: an editor that reads `enter`
    // alone puts a newline in the file and swallows the ask.
    t.press('alt+enter');
    await quiet();
    expect(t.hasText('Rename')).toBe(true);
    expect(t.store.get<{ state?: { line?: number } }>(
      panelViewPath('pane.main', uri('long.txt')),
    )?.state?.line ?? 0, 'and typed nothing').toBe(0);
    await t.unmount();
  });
});

/**
 * The changed lines, washed as well as marked.
 *
 * Off by default: it says a second time what the gutter already says, and it
 * costs contrast on every row it touches.
 */
describe('highlighting what changed', () => {
  it('is a toggle, and the workspace remembers it', async () => {
    const { t, quiet } = await open();
    expect(t.store.get('$/ui/editor/markLines')).toBeFalsy();

    await t.app.execute('view.markLines');
    await quiet();
    expect(t.store.get('$/ui/editor/markLines')).toBe(true);

    await t.app.execute('view.markLines');
    await quiet();
    expect(t.store.get('$/ui/editor/markLines')).toBe(false);
    await t.unmount();
  });
});

/**
 * Find, in the file in front of you.
 *
 * The query is in the store and whoever is showing the text picks it up: the
 * editor paints every match and moves its own caret, the status bar counts
 * them. The command knows nothing about carets.
 */
describe('finding in a file', () => {
  it('goes to the first match, then steps through them', async () => {
    const { t, quiet, uri } = await open();
    t.app.store.set(EDITOR_URI, uri('long.txt'));
    await quiet();
    await t.app.execute('file.edit');
    await quiet();

    await t.app.execute('find.inFile', { text: 'line 40 ' });
    await quiet();
    const line = (): number | undefined => t.store.get<{ state?: { line?: number } }>(
      panelViewPath('pane.main', uri('long.txt')),
    )?.state?.line;
    // Straight there: a search that finds something and leaves you where you
    // were has not answered the question.
    expect(line()).toBe(39);

    await t.app.execute('find.inFile', { text: 'of the document' });
    await quiet();
    const first = line();
    await t.app.execute('find.next');
    await quiet();
    expect(line(), 'and next moves on').toBeGreaterThan(first as number);

    await t.app.execute('find.previous');
    await quiet();
    expect(line()).toBe(first);
    await t.unmount();
  }, 20_000);

  it('counts what it found, in the status bar', async () => {
    const { t, quiet, uri } = await open();
    t.app.store.set(EDITOR_URI, uri('long.txt'));
    await quiet();
    await t.app.execute('file.edit');
    await quiet();

    await t.app.execute('find.inFile', { text: 'line 1 of' });
    await quiet();
    expect(t.hasText('1 of 1 for "line 1 of"')).toBe(true);

    await t.app.execute('find.inFile', { text: 'nothing here at all' });
    await quiet();
    // Saying so, rather than a bar that looks the same whether it found
    // something or not.
    expect(t.hasText('no matches')).toBe(true);

    await t.app.execute('find.clear');
    await quiet();
    expect(t.hasText('no matches')).toBe(false);
    await t.unmount();
  }, 20_000);
});

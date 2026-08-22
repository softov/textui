import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderApp } from '@textui/testing';
import { getDocument } from '@textui/documents';
import { loadWorkspace, quitCommand, registerTextide } from '../src/index.js';
import { EDITOR_URI } from '../src/tabs.js';

/**
 * Leaving, and what happens to what you had not saved.
 *
 * Quit is two keystrokes from anywhere - the last entry in the File menu, so
 * one `up` from the first the moment it opens - and it used to exit on the
 * spot. This is the test that stops that coming back.
 */

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'textide-quit-'));
  await writeFile(join(dir, 'a.txt'), 'alpha\n');
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function open() {
  const workspace = await loadWorkspace(dir);
  const exit = vi.fn();
  const t = await renderApp({
    width: 90, height: 20, shell: 'workbench', theme: 'workbench',
    onBoot: (app) => {
      registerTextide(app, { workspace });
      app.commands.register(quitCommand(app, { exit }));
    },
  });
  const quiet = async (): Promise<void> => {
    for (let i = 0; i < 12; i++) { await t.settle(); t.advance(50); t.flush(); }
  };
  await quiet();
  return { t, quiet, exit, uri: `file://${join(dir, 'a.txt')}` };
}

describe('quitting', () => {
  it('goes, when there is nothing to lose', async () => {
    const { t, quiet, exit } = await open();
    await t.app.execute('app.quit');
    await quiet();
    expect(exit).toHaveBeenCalled();
    await t.unmount();
  });

  it('asks first, and names the file', async () => {
    const { t, quiet, exit, uri } = await open();
    t.app.store.set(EDITOR_URI, uri);
    await quiet();
    await t.app.execute('file.edit');
    await quiet();
    t.press('end');
    t.type(' and more');
    await quiet();
    expect(getDocument(t.app.store, uri)?.content).toContain('and more');

    void t.app.execute('app.quit');
    await quiet();
    expect(exit, 'nothing has happened yet').not.toHaveBeenCalled();
    // "You have unsaved changes" leaves you to guess which file and whether
    // you care, and the answer is usually one file.
    expect(t.hasText('a.txt has unsaved changes')).toBe(true);

    await t.unmount();
  });

  it('stays when the answer is no, and the buffer is untouched', async () => {
    const { t, quiet, exit, uri } = await open();
    t.app.store.set(EDITOR_URI, uri);
    await quiet();
    await t.app.execute('file.edit');
    await quiet();
    t.press('end');
    t.type('!');
    await quiet();

    void t.app.execute('app.quit');
    await quiet();
    t.press('escape');
    await quiet();

    expect(exit).not.toHaveBeenCalled();
    expect(getDocument(t.app.store, uri)?.content).toContain('!');
    await t.unmount();
  });

  it('is not bound to a bare letter', async () => {
    const { t } = await open();
    // `q` quits a pager, where there is nothing to lose. In something holding
    // unsaved files it is a keystroke in the file tree away from closing.
    const bound = t.app.keybindings.list().filter((b) => b.commandId === 'app.quit');
    expect(bound.map((b) => b.keys)).not.toContain('q');
    await t.unmount();
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderApp } from '@textui/testing';
import { CONFIG_FILE, loadWorkspace, registerTextide, rememberSettings } from '../src/index.js';

/**
 * Settings that stick.
 *
 * A preference you have to set again every morning is not a preference. The
 * store already holds every one of them, so remembering is a short list of
 * paths and a file.
 */

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'textide-settings-'));
  await writeFile(join(dir, 'a.txt'), 'alpha\n');
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function open(config: Record<string, unknown> = {}) {
  await writeFile(join(dir, CONFIG_FILE), JSON.stringify(config));
  const workspace = await loadWorkspace(dir);
  const t = await renderApp({
    width: 90, height: 20, shell: 'workbench', theme: 'workbench',
    // Off, so a test drives the saving itself rather than racing a debounce.
    onBoot: (app) => registerTextide(app, { workspace, remember: false }),
  });
  const quiet = async (): Promise<void> => {
    for (let i = 0; i < 10; i++) { await t.settle(); t.advance(50); t.flush(); }
  };
  await quiet();
  return { t, quiet, workspace };
}

describe('what a workspace remembers', () => {
  it('is in the store before the first frame', async () => {
    const { t } = await open({ diff: 'split', layout: 'stack' });
    expect(t.store.get('$/ui/diff/mode')).toBe('split');
    expect(t.store.get('$/ui/editor/layout')).toBe('stack');
    await t.unmount();
  });

  it('leaves alone what the file did not mention', async () => {
    const { t } = await open({});
    // Seeding an absent setting with `undefined` would overwrite whatever the
    // shell had already decided.
    expect(t.store.get('$/ui/diff/mode')).toBeUndefined();
    await t.unmount();
  });

  it('writes a change back, once', async () => {
    const { t, workspace } = await open({});
    const saves: Record<string, unknown>[] = [];
    const bag = rememberSettings(t.app, workspace, {
      debounceMs: 1,
      write: async (config) => { saves.push(config); },
    });

    t.app.store.set('$/ui/diff/mode', 'split');
    t.app.store.set('$/ui/editor/layout', 'split');
    await new Promise((resolve) => { setTimeout(resolve, 20); });

    // Two changes in a breath are one decision, not two files written.
    expect(saves).toHaveLength(1);
    expect(saves[0]).toMatchObject({ diff: 'split', layout: 'split' });
    bag.dispose();
    await t.unmount();
  });

  it('keeps what it has never heard of', async () => {
    await writeFile(join(dir, CONFIG_FILE), JSON.stringify({ somebodyElse: { deep: 1 } }));
    const workspace = await loadWorkspace(dir);
    const t = await renderApp({
      width: 80, height: 10, onBoot: (app) => registerTextide(app, { workspace, remember: false }),
    });
    const bag = rememberSettings(t.app, workspace, { debounceMs: 1 });
    t.app.store.set('$/ui/diff/mode', 'split');
    await new Promise((resolve) => { setTimeout(resolve, 40); });

    const written = JSON.parse(await readFile(join(dir, CONFIG_FILE), 'utf8')) as
      Record<string, unknown>;
    // An extension's settings, or a key from a later version, survives being
    // saved by this one.
    expect(written.somebodyElse).toEqual({ deep: 1 });
    expect(written.diff).toBe('split');
    bag.dispose();
    await t.unmount();
  });
});

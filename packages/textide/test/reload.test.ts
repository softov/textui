import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderApp } from '@textui/testing';
import { getDocument, isDocumentDirty } from '@textui/documents';
import { loadWorkspace, registerTextide } from '../src/index.js';
import { createReloader, STATUS_SEGMENTS } from '../src/reload.js';
import type { Registrar } from '../src/reload.js';
import { EDITOR_URI, allTabs } from '../src/tabs.js';

/**
 * Everything above the status bar.
 *
 * The reload reports itself in the status bar on purpose, so that is the one
 * row that is expected to differ - comparing it too would only assert that the
 * report happened, which has its own test.
 */
function body(t: { lines(): string[] }): string {
  return t.lines().slice(0, -2).join('\n');
}

/**
 * Hot reload.
 *
 * The build watch is not the interesting half. What these check is the half
 * that goes wrong: that a reload disposes exactly what it registered, that a
 * failed build leaves a working editor behind, and that the store - which is
 * where everything a person would hate to lose actually lives - comes through
 * untouched.
 */

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'textide-reload-'));
  await writeFile(join(dir, 'alpha.txt'), 'alpha one\nalpha two\n');
  await writeFile(join(dir, 'beta.txt'), 'beta one\n');
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function running() {
  const workspace = await loadWorkspace(dir);
  let bag: ReturnType<typeof registerTextide> | null = null;
  const t = await renderApp({
    width: 96, height: 20, shell: 'workbench', theme: 'workbench',
    onBoot: (app) => { bag = registerTextide(app, { workspace }); },
  });
  const quiet = async (): Promise<void> => {
    for (let i = 0; i < 12; i++) { await t.settle(); t.advance(50); t.flush(); }
  };
  await quiet();

  const again: Registrar = (app) => registerTextide(app, { workspace });
  const reloader = createReloader(t.app, {
    initial: bag as unknown as { dispose(): void },
    load: async () => again,
  });
  const uri = (name: string): string => `file://${join(dir, name)}`;
  return { t, quiet, reloader, uri, again };
}

describe('a reload', () => {
  it('registers each thing once, however many times it runs', async () => {
    const { t, quiet, reloader } = await running();
    const commands = t.app.commands.list().length;
    const bindings = t.app.keybindings.list().length;
    const components = t.app.components.list().length;

    for (let i = 0; i < 3; i++) {
      expect((await reloader.reload()).ok).toBe(true);
      await quiet();
    }

    expect(t.app.commands.list().length, 'two file.save is one too many').toBe(commands);
    expect(t.app.keybindings.list().length).toBe(bindings);
    expect(t.app.components.list().length).toBe(components);
    await t.unmount();
  });

  it('draws the same screen afterwards', async () => {
    const { t, quiet, reloader } = await running();
    const before = body(t);
    await reloader.reload();
    await quiet();
    expect(body(t)).toBe(before);
    await t.unmount();
  });

  /**
   * The whole point. Quit-and-run costs the navigating, not the starting, so a
   * reload that lost the open file and the unsaved edit would be a slower way
   * of doing the thing it replaces.
   */
  it('keeps the open file, the strip and an unsaved edit', async () => {
    const { t, quiet, reloader, uri } = await running();
    t.app.store.set(EDITOR_URI, uri('alpha.txt'));
    await quiet();
    t.app.store.set(EDITOR_URI, uri('beta.txt'));
    await quiet();
    t.app.execute('file.edit');
    await quiet();
    t.type('!');
    await quiet();
    expect(isDocumentDirty(t.app.store, uri('beta.txt'))).toBe(true);

    expect((await reloader.reload()).ok).toBe(true);
    await quiet();

    expect(t.app.store.get(EDITOR_URI)).toBe(uri('beta.txt'));
    expect(allTabs(t.app.store)).toEqual([uri('alpha.txt'), uri('beta.txt')]);
    expect(isDocumentDirty(t.app.store, uri('beta.txt')), 'the edit survived').toBe(true);
    expect(getDocument(t.app.store, uri('beta.txt'))?.content).toBe('!beta one\n');
    await t.unmount();
  });

  it('leaves a sidebar somebody opened where they left it', async () => {
    const { t, quiet, reloader } = await running();
    t.app.store.set('$/ui/sidebar/collapsed', true);
    await quiet();
    await reloader.reload();
    await quiet();
    expect(t.app.store.get('$/ui/sidebar/collapsed')).toBe(true);
    await t.unmount();
  });

  /**
   * An overlay is a node built by the module that is about to stop existing.
   * Leaving it up puts a palette from the previous build over the new one, and
   * nothing sensible can be said about what its rows would run.
   */
  it('closes every layer', async () => {
    const { t, quiet, reloader } = await running();
    t.app.execute('app.palette');
    await quiet();
    expect(t.app.layers.entries().length).toBeGreaterThan(0);

    await reloader.reload();
    await quiet();
    expect(t.app.layers.entries()).toEqual([]);
    await t.unmount();
  });

  it('says so in the status bar rather than in a toast over the frame', async () => {
    const { t, quiet, reloader } = await running();
    await reloader.reload();
    await quiet();
    const segments = t.app.store.get<{ id: string; label: string }[]>(STATUS_SEGMENTS) ?? [];
    expect(segments.map((s) => s.id)).toContain('reload');
    expect(t.hasText('reloaded 1')).toBe(true);
    await t.unmount();
  });
});

describe('a reload that cannot happen', () => {
  /**
   * Disposing the registries and then failing to fill them is a black screen
   * with no way back, so nothing is disposed until there is something to put
   * in its place.
   */
  it('leaves the running editor alone when the build fails', async () => {
    const workspace = await loadWorkspace(dir);
    let bag: ReturnType<typeof registerTextide> | null = null;
    const t = await renderApp({
      width: 96, height: 20, shell: 'workbench', theme: 'workbench',
      onBoot: (app) => { bag = registerTextide(app, { workspace }); },
    });
    for (let i = 0; i < 12; i++) { await t.settle(); t.advance(50); t.flush(); }

    const reloader = createReloader(t.app, {
      initial: bag as unknown as { dispose(): void },
      load: () => Promise.reject(new Error('esbuild said no')),
    });

    const before = body(t);
    const commands = t.app.commands.list().length;
    const outcome = await reloader.reload();
    for (let i = 0; i < 12; i++) { await t.settle(); t.advance(50); t.flush(); }

    expect(outcome.ok).toBe(false);
    expect(t.app.commands.list().length, 'nothing was disposed').toBe(commands);
    expect(t.hasText('reload failed'), 'and it says so').toBe(true);
    expect(body(t), 'the screen is the one that was already working').toBe(before);
    await t.unmount();
  });

  it('refuses a second reload while one is running', async () => {
    const { t, reloader } = await running();
    const [first, second] = await Promise.all([reloader.reload(), reloader.reload()]);
    expect(first.ok || second.ok, 'one of them went through').toBe(true);
    expect(first.ok && second.ok, 'and only one').toBe(false);
    await t.unmount();
  });
});

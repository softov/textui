import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderApp } from '@textui/testing';
import { loadExtensions, loadWorkspace, registerTextide, resolveSpecifier } from '../src/index.js';
import type { ExtensionModule } from '../src/index.js';

/**
 * Extensions.
 *
 * The contract is one function and one `Disposable`, so what these check is
 * that the boundary holds in both directions: what an extension registers
 * arrives, what it fails to do is survivable, and disposing takes exactly its
 * own things back out.
 */

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'textide-ext-'));
  await writeFile(join(dir, 'a.txt'), 'a\n');
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function open(extensions: string[]) {
  const workspace = await loadWorkspace(dir);
  workspace.extensions = extensions;
  const t = await renderApp({
    width: 90, height: 16, shell: 'workbench', theme: 'workbench',
    onBoot: (app) => registerTextide(app, { workspace }),
  });
  for (let i = 0; i < 10; i++) { await t.settle(); t.advance(50); t.flush(); }
  return { t, workspace };
}

describe('loading', () => {
  it('registers what an extension registers, and unregisters it on dispose', async () => {
    const { t, workspace } = await open(['pretend']);
    const module: ExtensionModule = {
      activate: (app) => app.commands.register({
        id: 'pretend.hello', title: 'Hello', slots: ['palette'], run: () => {},
      }),
    };
    const bag = await loadExtensions(t.app, workspace, { load: () => Promise.resolve(module) });

    expect(t.app.commands.get('pretend.hello')).toBeDefined();
    bag.dispose();
    expect(t.app.commands.get('pretend.hello')).toBeUndefined();
    await t.unmount();
  });

  /**
   * An editor that will not open because one extension is missing is an editor
   * that has made a plugin mandatory, which is the opposite of a plugin.
   */
  it('carries on past one that is broken', async () => {
    const { t, workspace } = await open(['broken', 'missing-activate', 'fine']);
    const failures: string[] = [];
    const bag = await loadExtensions(t.app, workspace, {
      onError: (specifier) => { failures.push(specifier); },
      load: (specifier) => {
        if (specifier === 'broken') return Promise.reject(new Error('no such module'));
        if (specifier === 'missing-activate') return Promise.resolve({} as ExtensionModule);
        return Promise.resolve<ExtensionModule>({
          activate: (app) => app.commands.register({
            id: 'fine.hello', title: 'Hello', slots: [], run: () => {},
          }),
        });
      },
    });

    expect(failures).toEqual(['broken', 'missing-activate']);
    expect(t.app.commands.get('fine.hello'), 'the good one still loaded').toBeDefined();
    bag.dispose();
    await t.unmount();
  });

  it('loads a file the workspace points at, off disk', async () => {
    await writeFile(join(dir, 'ext.mjs'), `
      export function activate(app, context) {
        const registration = app.commands.register({
          id: 'local.hello',
          title: context.root,
          slots: [],
          run: () => {},
        });
        return registration;
      }
    `);
    const { t, workspace } = await open(['./ext.mjs']);
    const bag = await loadExtensions(t.app, workspace);

    const command = t.app.commands.get('local.hello');
    expect(command, 'it was imported and activated').toBeDefined();
    expect(command?.title, 'and was told where the workspace is').toBe(dir);
    bag.dispose();
    expect(t.app.commands.get('local.hello')).toBeUndefined();
    await t.unmount();
  });

  it('does nothing at all when a workspace asks for nothing', async () => {
    const { t, workspace } = await open([]);
    const before = t.app.commands.list().length;
    const bag = await loadExtensions(t.app, workspace);
    expect(t.app.commands.list().length).toBe(before);
    bag.dispose();
    await t.unmount();
  });
});

describe('resolving what the config says', () => {
  it('reads a relative path against the workspace, not the editor', () => {
    expect(resolveSpecifier('./tools/x.js', dir)).toBe(`file://${join(dir, 'tools/x.js')}`);
    expect(resolveSpecifier(join(dir, 'y.js'), dir)).toBe(`file://${join(dir, 'y.js')}`);
  });

  /**
   * A bare specifier that the workspace cannot resolve is handed on as it
   * stands. Inventing a path would turn "not installed" into a file-not-found
   * for a file nobody named.
   */
  it('leaves a bare specifier alone when the workspace has no answer', () => {
    expect(resolveSpecifier('@someone/textide-thing', dir)).toBe('@someone/textide-thing');
  });
});

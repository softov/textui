import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderApp } from '@textui/testing';
import {
  loadExtensions, loadWorkspace, registerTextide, relativeSpecifier, resolveSpecifier,
} from '../src/index.js';
import type { ExtensionModule, LoadedExtension } from '../src/index.js';
import { ASKED_PATH, EXTENSIONS_PATH } from '../src/index.js';

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

  /**
   * Nothing loaded, but the door is there. The loader's own three commands
   * register whether or not anything came in - a workspace with no extensions
   * is exactly the one where you want to be able to add the first.
   */
  it('loads nothing, and leaves only its own commands behind', async () => {
    const { t, workspace } = await open([]);
    const before = t.app.commands.list().map((c) => c.id);
    const extensions = await loadExtensions(t.app, workspace);

    expect(extensions.list()).toEqual([]);
    const added = t.app.commands.list().map((c) => c.id).filter((id) => !before.includes(id));
    expect(added.sort()).toEqual(['extensions.disable', 'extensions.install', 'extensions.installFile',
      'extensions.new', 'extensions.remove']);

    extensions.dispose();
    expect(t.app.commands.list().map((c) => c.id).sort()).toEqual([...before].sort());
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

/**
 * The manifest.
 *
 * It exists because nothing could ask an extension what it was: git registered
 * five kinds of thing inside `activate` and handed back one opaque disposable.
 * What these check is that the answer is now available without anything naming
 * git - identity from the manifest, contributions observed rather than
 * re-declared, and a failure that is a row saying so rather than an absence.
 */
describe('what an extension says about itself', () => {
  const withManifest: ExtensionModule = {
    manifest: {
      source: {
        id: 'test.demo',
        displayName: 'Demo',
        version: '2.1.0',
        description: 'Something to list.',
      },
    },
    activate: (app) => app.commands.register({
      id: 'demo.run', title: 'Run', slots: ['palette'], run: () => {},
    }),
  };

  it('lists an extension by its manifest', async () => {
    const { t, workspace } = await open(['demo']);
    const extensions = await loadExtensions(t.app, workspace, {
      load: () => Promise.resolve(withManifest),
    });

    expect(extensions.list()).toHaveLength(1);
    const one = extensions.get('test.demo');
    expect(one?.source.displayName).toBe('Demo');
    expect(one?.source.version).toBe('2.1.0');
    expect(one?.state).toBe('loaded');
    extensions.dispose();
    await t.unmount();
  });

  it('gives one with no manifest an identity from its specifier', async () => {
    const { t, workspace } = await open(['@acme/textide-spell-check']);
    const extensions = await loadExtensions(t.app, workspace, {
      load: () => Promise.resolve<ExtensionModule>({ activate: () => ({ dispose: () => {} }) }),
    });

    const one = extensions.list()[0];
    expect(one?.source.id).toBe('@acme/textide-spell-check');
    expect(one?.source.displayName).toBe('Spell Check');
    expect(one?.state).toBe('loaded');
    extensions.dispose();
    await t.unmount();
  });

  /**
   * Observed, not declared. A manifest that also listed the commands would be
   * a second copy of a list that already exists, and it would be wrong within
   * a release.
   */
  it('records what appeared in the registries while it was activating', async () => {
    const { t, workspace } = await open(['demo']);
    const extensions = await loadExtensions(t.app, workspace, {
      load: () => Promise.resolve<ExtensionModule>({
        manifest: { source: { id: 'test.demo', displayName: 'Demo' } },
        activate: (app) => {
          const bag = [
            app.commands.register({ id: 'demo.one', title: 'One', slots: [], run: () => {} }),
            app.commands.register({ id: 'demo.two', title: 'Two', slots: [], run: () => {} }),
            app.resources.registerKind({ id: 'demo.thing', title: 'Thing' }),
          ];
          return { dispose: () => { for (const d of bag) d.dispose(); } };
        },
      }),
    });

    const one = extensions.get('test.demo');
    expect(one?.contributed.commands).toEqual(['demo.one', 'demo.two']);
    expect(one?.contributed.kinds).toEqual(['demo.thing']);
    extensions.dispose();
    await t.unmount();
  });

  it('keeps a failed one on the list, with why', async () => {
    const { t, workspace } = await open(['broken']);
    const extensions = await loadExtensions(t.app, workspace, {
      onError: () => {},
      load: () => Promise.reject(new Error('no such module')),
    });

    const one = extensions.list()[0];
    expect(one?.state).toBe('failed');
    expect(one?.error).toContain('no such module');
    extensions.dispose();
    await t.unmount();
  });

  it('publishes the list, so a panel reads it like anything else', async () => {
    const { t, workspace } = await open(['demo']);
    const extensions = await loadExtensions(t.app, workspace, {
      load: () => Promise.resolve(withManifest),
    });

    const published = t.app.store.get<LoadedExtension[]>(EXTENSIONS_PATH as never) ?? [];
    expect(published.map((e) => e.source.id)).toEqual(['test.demo']);
    extensions.dispose();
    await t.unmount();
  });
});

/**
 * One bag each.
 *
 * The single shared bag that came before could only be emptied all at once,
 * which is why nothing could be turned off on its own.
 */
describe('disabling one of them', () => {
  it('takes out exactly that one and leaves the rest', async () => {
    const { t, workspace } = await open(['one', 'two']);
    const extensions = await loadExtensions(t.app, workspace, {
      load: (specifier) => Promise.resolve<ExtensionModule>({
        manifest: { source: { id: `test.${specifier}`, displayName: specifier } },
        activate: (app) => app.commands.register({
          id: `${specifier}.hello`, title: 'Hello', slots: [], run: () => {},
        }),
      }),
    });

    expect(t.app.commands.get('one.hello')).toBeDefined();
    expect(t.app.commands.get('two.hello')).toBeDefined();

    extensions.disable('test.one');
    expect(t.app.commands.get('one.hello')).toBeUndefined();
    expect(t.app.commands.get('two.hello'), 'the other one is untouched').toBeDefined();

    extensions.dispose();
    await t.unmount();
  });

  it('leaves the row in place, saying it is off', async () => {
    const { t, workspace } = await open(['one']);
    const extensions = await loadExtensions(t.app, workspace, {
      load: () => Promise.resolve<ExtensionModule>({
        manifest: { source: { id: 'test.one', displayName: 'One' } },
        activate: () => ({ dispose: () => {} }),
      }),
    });

    extensions.disable('test.one');
    // Something you turned off is something you want to see and turn back on,
    // not something that vanished.
    expect(extensions.get('test.one')?.state).toBe('disabled');
    expect(extensions.list()).toHaveLength(1);
    extensions.dispose();
    await t.unmount();
  });
});

/**
 * A panel is `contributes.views`, which is core's, and it mounts last so it
 * may name a component the same manifest just registered. Nothing about a
 * panel is textide's own idea.
 */
describe('a panel an extension brings', () => {
  const panels: ExtensionModule = {
    manifest: {
      source: { id: 'test.panels', displayName: 'Panels' },
      contributes: {
        components: [{
          component: 'DemoPanel',
          category: 'chrome',
          renderer: { kind: 'template', template: { component: 'text', content: 'demo panel' } },
        }],
        views: [{
          surface: 'sidebar',
          key: 'demo.list',
          target: { component: 'DemoPanel' },
          display: { title: 'Demo' },
        }],
      },
    },
  };

  it('needs no activate at all, and is mounted by the manifest', async () => {
    const { t, workspace } = await open(['panels']);
    const extensions = await loadExtensions(t.app, workspace, {
      load: () => Promise.resolve(panels),
    });

    expect(t.app.surfaces.get('sidebar', 'demo.list')).toBeDefined();
    extensions.dispose();
    expect(t.app.surfaces.get('sidebar', 'demo.list'), 'and unmounted again').toBeUndefined();
    await t.unmount();
  });

  /**
   * Which is what `view.sidebarPanel` reads. The command asks the surface
   * registry, not an extension list, so the explorer and a panel git brought
   * are the same kind of thing to it.
   */
  it('joins the explorer in the sidebar, as one more mount', async () => {
    const { t, workspace } = await open(['panels']);
    const extensions = await loadExtensions(t.app, workspace, {
      load: () => Promise.resolve(panels),
    });

    const keys = t.app.surfaces.mounts('sidebar').map((m) => m.key);
    expect(keys).toContain('explorer');
    expect(keys).toContain('demo.list');

    // And one at a time: the explorer is still what is showing.
    expect(t.hasText('demo panel')).toBe(false);
    extensions.dispose();
    await t.unmount();
  });

  it('records the mount it brought, alongside its commands', async () => {
    const { t, workspace } = await open(['panels']);
    const extensions = await loadExtensions(t.app, workspace, {
      load: () => Promise.resolve(panels),
    });

    expect(extensions.get('test.panels')?.contributed.views).toEqual(['sidebar/demo.list']);
    extensions.dispose();
    await t.unmount();
  });
});

/**
 * Bringing one in, and taking one out.
 *
 * The point of the loader keeping a record is that neither of these needs a
 * restart or a text editor. `install` is the same code path as boot, so the two
 * cannot come to disagree about what "loaded" means; what differs is only that
 * one of them writes the specifier down.
 */
describe('adding an extension while it is running', () => {
  const module = (id: string): ExtensionModule => ({
    manifest: {
      source: { id: `test.${id}`, displayName: id },
      contributes: { commands: [{ id: `${id}.go`, title: 'Go', slots: [], run: () => {} }] },
    },
  });

  it('loads it and writes it down', async () => {
    const { t, workspace } = await open([]);
    const extensions = await loadExtensions(t.app, workspace, {
      load: (s) => Promise.resolve(module(s)),
    });

    expect(extensions.asked()).toEqual([]);
    const id = await extensions.install('later');
    expect(id).toBe('test.later');
    expect(t.app.commands.get('later.go')).toBeDefined();
    // Which is what `rememberSettings` watches, so it reaches .textide.json.
    expect(t.app.store.get(ASKED_PATH as never)).toEqual(['later']);

    extensions.dispose();
    await t.unmount();
  });

  it('writes nothing down for one that would not load', async () => {
    const { t, workspace } = await open([]);
    const extensions = await loadExtensions(t.app, workspace, {
      onError: () => {},
      load: () => Promise.reject(new Error('nope')),
    });

    expect(await extensions.install('broken')).toBeNull();
    // A specifier that threw would fail the same way at the next boot, with
    // nobody watching. It is on the list as a failure, not in the config.
    expect(extensions.get('broken')?.state).toBe('failed');
    expect(t.app.store.get(ASKED_PATH as never)).toEqual([]);

    extensions.dispose();
    await t.unmount();
  });

  it('does not load one twice', async () => {
    const { t, workspace } = await open([]);
    let loads = 0;
    const extensions = await loadExtensions(t.app, workspace, {
      load: (s) => { loads++; return Promise.resolve(module(s)); },
    });

    await extensions.install('once');
    await extensions.install('once');
    expect(loads).toBe(1);
    expect(extensions.asked()).toEqual(['once']);

    extensions.dispose();
    await t.unmount();
  });

  /**
   * Disabling is "not now" and removing is "not again". A switch that quietly
   * meant the second one would lose a line of somebody's config file.
   */
  it('keeps a disabled one on the list, and takes a removed one off it', async () => {
    const { t, workspace } = await open(['a', 'b']);
    const extensions = await loadExtensions(t.app, workspace, {
      load: (s) => Promise.resolve(module(s)),
    });
    expect(extensions.asked()).toEqual(['a', 'b']);

    extensions.disable('test.a');
    expect(extensions.asked(), 'disabling changes no file').toEqual(['a', 'b']);
    expect(extensions.get('test.a')?.state).toBe('disabled');

    extensions.remove('test.b');
    expect(extensions.asked()).toEqual(['a']);
    expect(extensions.get('test.b'), 'and it is off the list entirely').toBeUndefined();
    expect(t.app.commands.get('b.go'), 'with its registrations').toBeUndefined();

    extensions.dispose();
    await t.unmount();
  });

  /**
   * `.textide.json` says what a *project* wants. Git arriving because there is
   * a `.git` directory is not something the project asked for, and writing it
   * in would turn a default into a decision nobody made.
   */
  it('does not write the built-ins into what the project asked for', async () => {
    const { t, workspace } = await open([]);
    const extensions = await loadExtensions(t.app, workspace, {
      load: (s) => Promise.resolve(module(s)),
    });
    expect(extensions.asked()).toEqual([]);
    extensions.dispose();
    await t.unmount();
  });
});

/**
 * What the picker hands back, as something a config file can hold.
 *
 * `.textide.json` travels with the project. An absolute path written into it
 * is a file that resolves on one machine and nowhere else, so the round trip
 * that matters is picker URI -> config entry -> `import()` specifier.
 */
describe('relativeSpecifier', () => {
  const root = 'file:///work/project';

  it.each([
    ['file:///work/project/tools/ext.js', './tools/ext.js'],
    ['file:///work/project/ext.js', './ext.js'],
    ['file:///work/project/a/b/c.mjs', './a/b/c.mjs'],
  ])('%s under the workspace becomes %s', (uri, expected) => {
    expect(relativeSpecifier(uri, root)).toBe(expected);
  });

  it('reads back to the file it came from', () => {
    const uri = 'file:///work/project/tools/ext.js';
    expect(resolveSpecifier(relativeSpecifier(uri, root), '/work/project')).toBe(uri);
  });

  it('decodes what the URI escaped', () => {
    // A space is `%20` in a URI and a space on disk. Writing the escape into
    // the config would ask `import()` for a file whose name has a percent in
    // it, which is a different file and usually no file at all.
    expect(relativeSpecifier('file:///work/project/my%20tools/ext.js', root))
      .toBe('./my tools/ext.js');
  });

  it('leaves a file outside the workspace absolute', () => {
    // There is no honest relative form, and a `../../..` chain out of the
    // project is worse than saying plainly where the file is.
    expect(relativeSpecifier('file:///elsewhere/ext.js', root)).toBe('/elsewhere/ext.js');
  });

  it('does not mistake a sibling directory for a child', () => {
    // `/work/project-two` starts with `/work/project`, and a prefix test
    // without the separator would call it `./-two/ext.js`.
    expect(relativeSpecifier('file:///work/project-two/ext.js', root))
      .toBe('/work/project-two/ext.js');
  });
});

import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Disposable, Manifest, ManifestSource, TextUIApp } from '@textui/core';
import { confirm, createBag, notify, pick, prompt } from '@textui/core';
import type { Workspace } from './workspace.js';

/**
 * Extensions.
 *
 * An extension is a module that exports `activate(app, context)`, a
 * `manifest`, or both. `activate` puts things into the registries and returns
 * a `Disposable` that takes exactly those things back out; the manifest is
 * core's `Manifest`, loaded through `app.manifest.load` before `activate`
 * runs, and it is the declarative half of the same idea.
 *
 * The manifest exists because nothing could ask an extension what it was. Git
 * registered commands, kinds, viewers, actions and a mount inside `activate`
 * and handed back one opaque disposable, so a list of what is loaded, a View
 * menu offering the panels, or a detail view of one of them all had to know
 * about git in particular.
 *
 * It is deliberately core's `Manifest` rather than a shape of textide's own.
 * `ManifestSource` is already identity, `contributes.views` is already panels,
 * and `app.manifest.unload(id)` is already exact disposal - a second manifest
 * type beside that one would be the duplicate this is meant to prevent.
 *
 * What this file adds is what only a *loader* knows: which specifier in
 * `.textide.json` produced which source, that one failed and why, and that
 * one was turned off. `app.manifest.sources()` lists what loaded; it cannot
 * list what did not.
 *
 * What a workspace loads is in `.textide.json`, so which extensions a project
 * uses is a property of the project rather than of the machine.
 *
 * A failure loads nothing and stops nothing else. An editor that will not open
 * because one extension is missing is an editor that has made a plugin
 * mandatory, which is the opposite of what a plugin is - and a failure is now
 * a row in the list saying so, rather than a toast that scrolls away.
 */

export interface ExtensionContext {
  /** The workspace root, which is what most extensions want to be pointed at. */
  root: string;
  workspace: Workspace;
}

/**
 * A module textide can load.
 *
 * Both halves are optional and at least one has to be there. An extension that
 * only contributes definitions is a manifest and no code; one that has to
 * subscribe to something, as git does, needs `activate` as well.
 */
export interface ExtensionModule {
  manifest?: Manifest;
  activate?(app: TextUIApp, context: ExtensionContext): Disposable | Promise<Disposable>;
}

/**
 * What appeared in the registries while an extension was loading.
 *
 * Observed rather than read off the manifest, because half of what git brings
 * arrives through `registerAdapter` inside `activate` and would be invisible
 * to anything that only read declarations. Observation covers both halves and
 * cannot fall out of step with either.
 */
export interface Contributed {
  commands: string[];
  kinds: string[];
  views: string[];
}

export type ExtensionState = 'loaded' | 'failed' | 'disabled';

/**
 * One extension, as something a panel can render.
 *
 * Plain data with no functions in it, so it survives the trip through the
 * store - which is how the Extensions panel reads it, the same way every other
 * panel reads what it draws.
 */
export interface LoadedExtension {
  /** What `.textide.json` named, which is the only identity a failure has. */
  specifier: string;
  source: ManifestSource;
  state: ExtensionState;
  /** Why it is not loaded. Present only when `state` is `failed`. */
  error?: string;
  contributed: Contributed;
}

/** Where the list of what is loaded is published. */
export const EXTENSIONS_PATH = '$/ui/extensions';

/**
 * The loaded set, and a handle on each one.
 *
 * Disposing this disposes all of them. `disable` disposes exactly one and
 * leaves the row in place saying so, because an extension you turned off is
 * something you want to see and turn back on, not something that vanished.
 */
export interface Extensions extends Disposable {
  list(): LoadedExtension[];
  get(id: string): LoadedExtension | undefined;
  /** What `.textide.json` asks for, which is not what is loaded. */
  asked(): string[];
  /**
   * Load one now and remember it. Returns its source id, or null if it did
   * not load - in which case nothing was remembered, because a specifier that
   * threw would fail the same way at the next boot with nobody watching.
   */
  install(specifier: string): Promise<string | null>;
  /** Off for this session. The row stays, saying so. */
  disable(id: string): void;
  /** Off, and out of the config file. Not the same decision as disabling. */
  remove(id: string): void;
}

/** What the workspace asked for, as store state, so a save can watch it. */
export const ASKED_PATH = '$/app/extensions';

/**
 * The identity of a module that brought no manifest.
 *
 * The specifier is all such a module has, so it becomes both the id and,
 * tidied, the name. An old extension keeps working and simply says less about
 * itself.
 */
function sourceFor(specifier: string): ManifestSource {
  const short = specifier.replace(/^@[^/]+\//, '').replace(/^textide-/, '');
  return {
    id: specifier,
    displayName: short.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
  };
}

export interface LoadOptions {
  /** Report a failure. Defaults to a toast. */
  onError?(specifier: string, error: unknown): void;
  /** Injected by a test, so nothing has to be on disk to be loadable. */
  load?(specifier: string): Promise<ExtensionModule>;
}

/**
 * Turn what the config says into something `import()` will take.
 *
 * A relative path is relative to the workspace, because that is what a person
 * writing `./tools/my-extension.js` in their own `.textide.json` means. A bare
 * specifier is resolved from the workspace too, so a project's own
 * `node_modules` is where its extensions come from - resolving from textide's
 * would mean an extension had to be installed beside the editor to be usable
 * in a project.
 */
export function resolveSpecifier(specifier: string, root: string): string {
  if (specifier.startsWith('.') || isAbsolute(specifier)) {
    return pathToFileURL(resolve(root, specifier)).href;
  }
  try {
    const require = createRequire(pathToFileURL(resolve(root, 'package.json')).href);
    return pathToFileURL(require.resolve(specifier)).href;
  } catch {
    // Not in the workspace's node_modules. Hand the bare specifier to the
    // loader and let Node say so, rather than inventing a path that is wrong.
    return specifier;
  }
}

/**
 * The inverse: a URI the picker handed back, as something a config can hold.
 *
 * `.textide.json` travels with the project, so an absolute path in it is a
 * file that resolves on one machine. A path under the workspace becomes
 * `./relative`, which `resolveSpecifier` reads back the same way; anything
 * outside stays absolute, because there is no honest relative form for it and
 * a `../../..` chain out of the project is worse than saying where the file is.
 */
export function relativeSpecifier(uri: string, rootUri: string): string {
  const root = rootUri.endsWith('/') ? rootUri : `${rootUri}/`;
  if (uri.startsWith(root)) return `./${decodeURIComponent(uri.slice(root.length))}`;
  return fileURLToPath(uri);
}

/**
 * What textide loads without being asked, and when.
 *
 * Git is the whole list. Opening textide in a repository and being told
 * nothing about it is the surprising behaviour, not the other way round - and
 * an extension that is not installed simply does not load, which is why this
 * can be a default without becoming a dependency.
 */
const BUILTIN: { specifier: string; wanted(root: string): boolean }[] = [
  {
    specifier: '@textui/textide-git',
    // The directory, not `git rev-parse`: this runs before the first frame and
    // a process spawn per boot to answer a question a directory entry already
    // answers is a spawn nobody asked for. A worktree's `.git` is a file
    // rather than a directory, so this asks about existence and nothing more.
    wanted: (root) => existsSync(join(root, '.git')),
  },
];

/** What the registries hold right now, for diffing either side of a load. */
function snapshot(app: TextUIApp): { commands: Set<string>; kinds: Set<string>; views: Set<string> } {
  const views = new Set<string>();
  for (const surface of ['sidebar', 'aside', 'main', 'panel'] as const) {
    for (const mount of app.surfaces.mounts(surface)) views.add(`${surface}/${mount.key}`);
  }
  return {
    commands: new Set(app.commands.list().map((c) => c.id)),
    kinds: new Set(app.resources.kinds().map((k) => k.id)),
    views,
  };
}

/**
 * Load every extension the workspace asks for, and keep the door open.
 *
 * Each gets its own bag, which is what makes one of them disableable: the
 * single shared bag that came before could only be emptied all at once. And
 * loading is one function rather than a loop body, so bringing one in from the
 * Extensions panel is the same code path as bringing one in at boot - a
 * second, nearly-identical path is how the two would come to disagree about
 * what "loaded" means.
 */
export async function loadExtensions(
  app: TextUIApp,
  workspace: Workspace,
  options: LoadOptions = {},
): Promise<Extensions> {
  const bag = createBag();
  const records = new Map<string, LoadedExtension>();
  const bags = new Map<string, Disposable>();

  const publish = (): void => {
    app.store.set(EXTENSIONS_PATH as never, [...records.values()]);
  };

  const report = options.onError ?? ((specifier: string, error: unknown): void => {
    notify(app, { tone: 'danger', message: `${specifier}: ${String(error)}` });
  });
  const importer = options.load
    ?? ((specifier: string): Promise<ExtensionModule> =>
      import(resolveSpecifier(specifier, workspace.root)) as Promise<ExtensionModule>);

  const context: ExtensionContext = { root: workspace.root, workspace };

  /** One extension, from specifier to record. Returns its id, or null. */
  async function loadOne(specifier: string): Promise<string | null> {
    const before = snapshot(app);
    try {
      const module = await importer(specifier);
      if (module.manifest === undefined && typeof module.activate !== 'function') {
        throw new Error('no manifest and no activate(app, context) export');
      }

      // One bag per extension, held by id rather than added to the shared one,
      // so `disable` has something to empty.
      const own = createBag();
      // The manifest first: it may register the component a mount in the same
      // manifest names, and `activate` may want what the manifest brought.
      if (module.manifest) own.add(await app.manifest.load(module.manifest));
      if (module.activate) own.add(await module.activate(app, context));

      const source = module.manifest?.source ?? sourceFor(specifier);
      const after = snapshot(app);
      records.set(source.id, {
        specifier,
        source,
        state: 'loaded',
        contributed: {
          commands: [...after.commands].filter((id) => !before.commands.has(id)),
          kinds: [...after.kinds].filter((id) => !before.kinds.has(id)),
          views: [...after.views].filter((key) => !before.views.has(key)),
        },
      });
      bags.set(source.id, own);
      bag.add(own);
      return source.id;
    } catch (error) {
      // Including the ones nobody asked for. An automatic extension is only
      // attempted when the workspace warrants it - git, in a repository - so
      // reaching this line means something that should have worked did not,
      // and silence there is what makes "why is there no git" unanswerable.
      const source = sourceFor(specifier);
      records.set(source.id, {
        specifier,
        source,
        state: 'failed',
        error: String(error),
        contributed: { commands: [], kinds: [], views: [] },
      });
      report(specifier, error);
      return null;
    }
  }

  const asked = workspace.extensions ?? [];
  // A built-in that is also listed is listed once: the config wins the
  // ordering, and loading a module twice would register everything twice.
  const automatic = workspace.builtinExtensions === false
    ? []
    : BUILTIN
      .filter((b) => b.wanted(workspace.root) && !asked.includes(b.specifier))
      .map((b) => b.specifier);

  for (const specifier of [...automatic, ...asked]) await loadOne(specifier);

  /*
   * What the workspace asked for, as store state.
   *
   * The built-ins are not in it: `.textide.json` says what a *project* wants,
   * and git arriving because there is a `.git` directory is not something the
   * project asked for. Writing it in would turn a default into a decision
   * nobody made, and turning the default off would then leave it loading.
   */
  const setAsked = (list: string[]): void => {
    app.store.set(ASKED_PATH as never, list);
  };
  setAsked(asked);

  const handle: Extensions = {
    list: () => [...records.values()],
    get: (id) => records.get(id),
    asked: () => (app.store.get<string[]>(ASKED_PATH as never) ?? []),
    async install(specifier) {
      // By specifier, because that is what the caller typed. The records are
      // keyed by source id, which is the manifest's - and the whole point of
      // not loading twice is to catch it before the module is imported and
      // gets to say what its id is.
      const already = [...records.values()]
        .find((e) => e.specifier === specifier && e.state === 'loaded');
      if (already) return already.source.id;
      const id = await loadOne(specifier);
      publish();
      if (id === null) return null;
      // Remembered only once it loaded. Writing a specifier that threw into
      // the config file means the next boot fails the same way, silently, and
      // the person who typed it is no longer looking.
      const list = handle.asked();
      if (!list.includes(specifier)) setAsked([...list, specifier]);
      return id;
    },
    disable(id) {
      const record = records.get(id);
      if (!record || record.state !== 'loaded') return;
      bags.get(id)?.dispose();
      bags.delete(id);
      records.set(id, { ...record, state: 'disabled' });
      publish();
    },
    remove(id) {
      const record = records.get(id);
      if (!record) return;
      bags.get(id)?.dispose();
      bags.delete(id);
      records.delete(id);
      setAsked(handle.asked().filter((s) => s !== record.specifier));
      publish();
    },
    dispose: () => { bag.dispose(); },
  };

  publish();
  bag.add({ dispose: () => { app.store.set(EXTENSIONS_PATH as never, []); } });

  // Registered here because this is the only thing holding the bags. Commands
  // rather than methods the panel calls, so the panel and the palette run one
  // implementation - and so a keybinding could reach them without this file
  // hearing about it.
  bag.add(app.commands.register({
    id: 'extensions.install',
    title: 'Add Extension',
    category: 'Extensions',
    slots: ['palette'],
    args: [{ name: 'specifier', type: 'string' }],
    run: async (args, ctx) => {
      const given = typeof args.specifier === 'string' ? args.specifier : null;
      const specifier = given ?? await prompt(ctx.app.layers, {
        title: 'Add Extension',
        message: 'A package name, or a path inside this workspace',
      });
      if (specifier === null || specifier === '') return;

      const id = await handle.install(specifier);
      if (id === null) return;  // `loadOne` already said what went wrong.
      const name = records.get(id)?.source.displayName ?? id;
      notify(ctx.app, { tone: 'success', message: `${name} loaded, and remembered.` });
    },
  }));

  /*
   * The other way to answer the same question.
   *
   * A specifier is either a package name or a path into the workspace, and
   * only one of those is a thing you can type from memory. Typing a path blind
   * is the worst way to give one - the point of picking is that you did not
   * already know the answer - so the path case gets a picker and the package
   * case keeps the field.
   *
   * Two rows rather than one command that asks which: each is one keystroke
   * from the palette, and neither makes you answer a question about how you
   * are going to answer the question.
   */
  bag.add(app.commands.register({
    id: 'extensions.installFile',
    title: 'Add Extension from File',
    category: 'Extensions',
    slots: ['palette'],
    run: async (_args, ctx) => {
      const chosen = await pick(ctx.app, {
        start: workspace.rootUri,
        wants: 'file',
        title: 'add extension',
      });
      if (chosen === null) return;

      // Stored as a path relative to the workspace, not as the `file://` URI
      // the picker deals in: `.textide.json` travels with the project, and an
      // absolute path in it is a file that resolves on one machine.
      const specifier = relativeSpecifier(chosen, workspace.rootUri);
      const id = await handle.install(specifier);
      if (id === null) return;
      const name = records.get(id)?.source.displayName ?? id;
      notify(ctx.app, { tone: 'success', message: `${name} loaded, and remembered.` });
    },
  }));

  bag.add(app.commands.register({
    id: 'extensions.disable',
    title: 'Disable Extension',
    category: 'Extensions',
    slots: ['palette'],
    keepOpen: true,
    args: [{
      name: 'id', type: 'string', required: true,
      choices: () => [...records.values()]
        .filter((e) => e.state === 'loaded')
        .map((e) => e.source.id),
    }],
    run: (args, ctx) => {
      const id = String(args.id ?? '');
      const record = records.get(id);
      if (!record) return;
      if (record.state !== 'loaded') {
        notify(app, { message: `${record.source.displayName ?? id} is already off.` });
        return;
      }
      handle.disable(id);
      // Off for this session only, on purpose: disabling is "not now" and
      // removing is "not again". A switch that quietly meant the second one
      // would lose a line of somebody's config file.
      notify(ctx.app, {
        tone: 'warning',
        message: `${record.source.displayName ?? id} is off until textide restarts.`,
      });
    },
  }));

  bag.add(app.commands.register({
    id: 'extensions.remove',
    title: 'Remove Extension',
    category: 'Extensions',
    slots: ['palette'],
    args: [{
      name: 'id', type: 'string', required: true,
      choices: () => [...records.values()].map((e) => e.source.id),
    }],
    run: async (args, ctx) => {
      const id = String(args.id ?? '');
      const record = records.get(id);
      if (!record) return;
      const name = record.source.displayName ?? id;
      // The one that edits a file the person owns, so it is the one that asks.
      const ok = await confirm(ctx.app.layers, {
        title: 'Remove',
        message: `Take ${name} out of .textide.json?`,
        confirmLabel: 'Remove',
        tone: 'danger',
      });
      if (!ok) return;
      handle.remove(id);
      notify(ctx.app, { tone: 'success', message: `${name} removed.` });
    },
  }));

  return handle;
}

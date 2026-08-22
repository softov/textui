import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Disposable, TextUIApp } from '@textui/core';
import { createBag, notify } from '@textui/core';
import type { Workspace } from './workspace.js';

/**
 * Extensions.
 *
 * An extension is a module that exports `activate(app, context)` and returns a
 * `Disposable`. That is the whole contract, and it is deliberately the same
 * one `registerTextide` follows: an extension puts things into the
 * application's registries, and disposing takes exactly those things back out.
 * There is no manifest, no activation event and no lifecycle - the registries
 * are already late-binding, so registering *is* the activation.
 *
 * What a workspace loads is in `.textide.json`, so which extensions a project
 * uses is a property of the project rather than of the machine.
 *
 * A failure loads nothing and stops nothing else. An editor that will not open
 * because one extension is missing is an editor that has made a plugin
 * mandatory, which is the opposite of what a plugin is.
 */

export interface ExtensionContext {
  /** The workspace root, which is what most extensions want to be pointed at. */
  root: string;
  workspace: Workspace;
}

export interface ExtensionModule {
  activate(app: TextUIApp, context: ExtensionContext): Disposable | Promise<Disposable>;
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

/**
 * Load every extension the workspace asks for.
 *
 * Returns one bag, so a host that wants to unload them all - or a reload that
 * wants to replace them - has a single thing to dispose.
 */
export async function loadExtensions(
  app: TextUIApp,
  workspace: Workspace,
  options: LoadOptions = {},
): Promise<Disposable> {
  const bag = createBag();
  const asked = workspace.extensions ?? [];
  // A built-in that is also listed is listed once: the config wins the
  // ordering, and loading a module twice would register everything twice.
  const automatic = workspace.builtinExtensions === false
    ? []
    : BUILTIN
      .filter((b) => b.wanted(workspace.root) && !asked.includes(b.specifier))
      .map((b) => b.specifier);
  const specifiers = [...automatic, ...asked];
  if (specifiers.length === 0) return bag;

  const report = options.onError ?? ((specifier: string, error: unknown): void => {
    notify(app, { tone: 'danger', message: `${specifier}: ${String(error)}` });
  });
  const load = options.load
    ?? ((specifier: string): Promise<ExtensionModule> =>
      import(resolveSpecifier(specifier, workspace.root)) as Promise<ExtensionModule>);

  const context: ExtensionContext = { root: workspace.root, workspace };

  for (const specifier of specifiers) {
    try {
      const module = await load(specifier);
      if (typeof module.activate !== 'function') {
        throw new Error('no activate(app, context) export');
      }
      bag.add(await module.activate(app, context));
    } catch (error) {
      // Including the ones nobody asked for. An automatic extension is only
      // attempted when the workspace warrants it - git, in a repository - so
      // reaching this line means something that should have worked did not,
      // and silence there is what makes "why is there no git" unanswerable.
      report(specifier, error);
    }
  }
  return bag;
}

import type { Disposable, TextUIApp } from '@textui/core';
import { createBag } from '@textui/core';
import { createGit, type Git } from './git.js';
import { GIT_KINDS, GIT_VIEWERS, createGitProvider, safeStatus } from './provider.js';
import { DIFF_COMPONENTS } from './diff.js';
import { GitChanges, STATUS_PATH, STATUS_SEGMENTS } from './changes.js';
import { gitCommands, refresh } from './commands.js';
import type { Status } from './git.js';

/**
 * Git for textide, as a loadable extension.
 *
 * Nothing in textide knows this exists. It arrives through the same door
 * anything else would - one adapter, some commands, a component and a mount -
 * and `registerGit` returns one bag that takes all of it back out again. That
 * is the test the extension point has to pass: if unloading git left a viewer
 * behind, or a status segment, or a row in the palette, the boundary would be
 * in the wrong place.
 *
 * It goes in the `aside` rather than the sidebar because the workbench shell
 * already reserves that region and already has a switch for it, so source
 * control arrives without taking half of the tree away from the explorer.
 */

export { createGit, parseStatus, readStatus, readDiff, readBranches, isRepository, GitError, EMPTY_STATUS } from './git.js';
export type { Git, GitOptions, Change, Status } from './git.js';
export { GitDiff, classify, scrollDiff, DIFF_COMPONENTS } from './diff.js';
export { GitChanges, codeOf, toneOf, summarize, GIT_ROOT, STATUS_PATH, SELECTED_PATH } from './changes.js';
export { gitCommands, refresh } from './commands.js';
export {
  SCHEME, DIFF_PREFIX, diffUri, diffPath, createGitProvider, safeStatus,
  GIT_KINDS, GIT_VIEWERS,
} from './provider.js';

export interface GitExtensionOptions {
  /** The working tree. Usually the workspace root. */
  root: string;
  /** Injected by a test, so nothing has to spawn a process. */
  git?: Git;
  /** Open the panel as soon as it loads. On by default. */
  reveal?: boolean;
}

export function registerGit(app: TextUIApp, options: GitExtensionOptions): Disposable {
  const git = options.git ?? createGit({ root: options.root });
  const bag = createBag();

  bag.add(app.components.registerMany([
    ...DIFF_COMPONENTS,
    {
      component: 'GitChanges',
      category: 'chrome',
      renderer: { kind: 'function', render: GitChanges },
      description: 'What has changed, staged and not.',
    },
  ]));

  bag.add(app.registerAdapter({
    id: 'textide.git',
    title: 'Git',
    description: 'Diffs, staging, commits and branches.',
    kinds: GIT_KINDS,
    viewers: GIT_VIEWERS,
    providers: [createGitProvider(git, () => app.store.get<Status>(STATUS_PATH) ?? {
      branch: null, ahead: 0, behind: 0, changes: [], clean: true,
    })],
    commands: gitCommands(app, { git, root: options.root }),
    actions: [
      { id: 'git.stage', title: 'Stage', kinds: ['*'], slots: ['context'], run: (args, ctx) => ctx.app.execute('git.stage', args) },
      { id: 'git.diff', title: 'Diff', kinds: ['*'], slots: ['context'], run: (args, ctx) => ctx.app.execute('git.diff', args) },
    ],
    keybindings: [
      { keys: 'ctrl+g', commandId: 'git.refresh' },
    ],
  }));

  bag.add(app.open({
    surface: 'aside',
    key: 'git',
    target: { component: 'GitChanges' },
    display: { title: 'Source Control' },
  }));

  if (options.reveal !== false) {
    const wasVisible = app.store.get<boolean>('$/ui/aside/visible') ?? false;
    app.store.set('$/ui/aside/visible', true);
    // Put the shell back the way it was found. An extension that leaves a
    // region open after it is unloaded has left a region with nothing in it.
    bag.add({ dispose: () => { app.store.set('$/ui/aside/visible', wasVisible); } });
  }

  // The status is store state like everything else, so the panel, the status
  // bar and every command read one answer. Seeding it here means the first
  // frame after loading already says which branch you are on.
  void refresh(app, git);

  bag.add({
    dispose: () => {
      app.store.set(STATUS_PATH, null);
      const rest = (app.store.get<{ id: string }[]>(STATUS_SEGMENTS) ?? [])
        .filter((s) => s.id !== 'git');
      app.store.set(STATUS_SEGMENTS, rest);
    },
  });

  return bag;
}

/**
 * The shape textide loads.
 *
 * `activate` rather than a default export, so a module that is also a library
 * - which this one is - does not have to choose between the two.
 */
export function activate(app: TextUIApp, context: { root: string }): Disposable {
  return registerGit(app, { root: context.root });
}

export { safeStatus as readSafeStatus };

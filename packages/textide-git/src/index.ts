import type { BindingPath, Disposable, Manifest, TextUIApp } from '@textui/core';
import { createBag } from '@textui/core';
import { clearDecorations, clearLineMarks, setDecorations, setLineMarks } from '@textui/widgets';
import { createGit, type Git } from './git.js';
import { GIT_KINDS, GIT_VIEWERS, createGitProvider, safeStatus } from './provider.js';
import { DIFF_COMPONENTS } from './diff.js';
import { HISTORY_COMPONENTS } from './views.js';
import { GitChanges, STATUS_PATH, STATUS_SEGMENTS } from './changes.js';
import { gitCommands, refresh } from './commands.js';
import { GIT_SOURCE, decorationsOf } from './decorate.js';
import { GUTTER_SOURCE, gutterFor } from './gutter.js';
import { DIFF_MODE, type DiffMode } from './diff.js';
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
export {
  GitDiff, classify, pairsOf, trimTrailing, scrollDiff, hunkOfLine, hunkOfPair,
  DIFF_MODE, DIFF_COMPONENTS,
} from './diff.js';
export type { DiffMode, DiffCell, DiffPair } from './diff.js';
export { GitChanges, codeOf, toneOf, summarize, GIT_ROOT, STATUS_PATH, SELECTED_PATH } from './changes.js';
export { gitCommands, refresh } from './commands.js';
export { GIT_SOURCE, decorationsOf } from './decorate.js';
export { GUTTER_SOURCE, marksOf, gutterFor } from './gutter.js';
export { parseHunks, patchFor, hunkAt } from './hunks.js';
export type { Hunk, Diff } from './hunks.js';
export {
  SCHEME, DIFF_PREFIX, LOG_PREFIX, BLAME_PREFIX,
  diffUri, diffPath, logUri, logPath, blameUri, blamePath,
  createGitProvider, safeStatus, GIT_KINDS, GIT_VIEWERS,
} from './provider.js';
export { GitLog, GitBlame, HISTORY_COMPONENTS } from './views.js';
export { parseLog, parseBlame, readLog, readBlame, authorWidth, LOG_FORMAT } from './history.js';
export type { Commit, BlameLine } from './history.js';

/** Where a host publishes what it has open. Read, never written. */
const EDITOR_OPEN = '$/ui/editor/uri' as BindingPath;

export interface GitExtensionOptions {
  /** The working tree. Usually the workspace root. */
  root: string;
  /** Injected by a test, so nothing has to spawn a process. */
  git?: Git;
  /** Open the panel as soon as it loads. On by default. */
  reveal?: boolean;
  /**
   * Put the Source Control panel on a surface. On by default.
   *
   * Off when textide loads this as an extension: the panel is declared in the
   * manifest and the loader mounts it, which is what puts it on the list a
   * View menu offers before it puts it on the screen. A host calling
   * `registerGit` directly is not going through that loader and still wants
   * its panel.
   */
  mount?: boolean;
  /** How diffs open. Unified unless the workspace remembered otherwise. */
  mode?: DiffMode;
}

export function registerGit(app: TextUIApp, options: GitExtensionOptions): Disposable {
  const git = options.git ?? createGit({ root: options.root });
  const bag = createBag();

  // Seeded, not forced: a host that remembered a layout says so here, and
  // anything that changes it afterwards - a command, a test - wins.
  if (options.mode !== undefined) app.store.set(DIFF_MODE, options.mode);

  bag.add(app.components.registerMany([
    ...DIFF_COMPONENTS,
    ...HISTORY_COMPONENTS,
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
      { keys: 'ctrl+g', commandId: 'git.show' },
    ],
  }));

  if (options.mount !== false) {
    bag.add(app.open({
      surface: 'aside',
      key: GIT_PANEL.id,
      target: { component: GIT_PANEL.component },
      display: { title: GIT_PANEL.title },
    }));
  }

  if (options.reveal !== false) {
    const wasVisible = app.store.get<boolean>('$/ui/aside/visible') ?? false;
    app.store.set('$/ui/aside/visible', true);
    // Put the shell back the way it was found. An extension that leaves a
    // region open after it is unloaded has left a region with nothing in it.
    bag.add({ dispose: () => { app.store.set('$/ui/aside/visible', wasVisible); } });
  }

  /*
   * The explorer's marks follow the status, rather than being pushed by
   * whatever caused it to change.
   *
   * Every command here ends in a refresh, and a commit made in another window
   * arrives the same way - so subscribing to the answer means the tree is
   * right after all of them, and no command has to remember to say so.
   */
  bag.add(app.store.subscribe(STATUS_PATH, () => {
    setDecorations(app.store, GIT_SOURCE, decorationsOf(
      app.store.get<Status>(STATUS_PATH) ?? null,
      options.root,
    ));
  }));

  /*
   * And the gutter of whatever is open, for the same reason and by the same
   * route - except that this one costs a process, so it is asked only about
   * the one file on screen and only when that file or the status changes.
   *
   * `$/ui/editor/uri` is read, never written: it is where a host publishes
   * what it has open, and a host that publishes nothing simply gets no gutter.
   */
  let generation = 0;
  const regutter = (): void => {
    const at = ++generation;
    const uri = app.store.get<string>(EDITOR_OPEN) ?? null;
    void gutterFor(git, app.store.get<Status>(STATUS_PATH) ?? null, options.root, uri)
      .then((marks) => {
        // A slower answer about a file that is no longer open would draw the
        // last file's changes over this one.
        if (at !== generation || uri === null) return;
        setLineMarks(app.store, GUTTER_SOURCE, uri, marks);
      })
      .catch(() => { /* a diff that will not run is a gutter that stays empty */ });
  };
  bag.add(app.store.subscribe(STATUS_PATH, regutter));
  bag.add(app.store.subscribe(EDITOR_OPEN, regutter));

  // The status is store state like everything else, so the panel, the status
  // bar and every command read one answer. Seeding it here means the first
  // frame after loading already says which branch you are on.
  void refresh(app, git);

  bag.add({
    dispose: () => {
      clearDecorations(app.store, GIT_SOURCE);
      clearLineMarks(app.store, GUTTER_SOURCE);
      app.store.set(STATUS_PATH, null);
      const rest = (app.store.get<{ id: string }[]>(STATUS_SEGMENTS) ?? [])
        .filter((s) => s.id !== 'git');
      app.store.set(STATUS_SEGMENTS, rest);
    },
  });

  return bag;
}

/** The one panel this brings, named once so the manifest and the mount agree. */
const GIT_PANEL = {
  id: 'git',
  title: 'Source Control',
  surface: 'aside',
  component: 'GitChanges',
} as const;

/**
 * What this extension is, for anything that wants to list it.
 *
 * A core `Manifest`, so textide's loader hands it straight to
 * `app.manifest.load` and gets exact disposal back - there is no second
 * manifest shape to keep in step with this one.
 *
 * Identity and the panel, and nothing else. The commands, kinds, viewers and
 * actions come through `registerAdapter` in `activate`, and the loader
 * observes what appeared rather than reading a list here that would be a
 * second copy of the one in `registerGit`.
 */
export const manifest: Manifest = {
  source: {
    id: 'textui.git',
    displayName: 'Git',
    description: 'Diffs, staging, commits and branches.',
  },
  contributes: {
    views: [{
      surface: GIT_PANEL.surface,
      key: GIT_PANEL.id,
      target: { component: GIT_PANEL.component },
      display: { title: GIT_PANEL.title },
    }],
  },
};

/**
 * The shape textide loads.
 *
 * `activate` rather than a default export, so a module that is also a library
 * - which this one is - does not have to choose between the two.
 */
export function activate(
  app: TextUIApp,
  context: { root: string; workspace?: { diff?: DiffMode } },
): Disposable {
  // Quietly, and without mounting: textide loads this by itself in a
  // repository, and a panel that opens because of what a directory contains
  // is an editor rearranging its own screen without being asked. `ctrl+g`
  // brings it out. The loader mounts what the manifest declares.
  return registerGit(app, {
    root: context.root,
    reveal: false,
    mount: false,
    ...(context.workspace?.diff !== undefined ? { mode: context.workspace.diff } : {}),
  });
}

export { safeStatus as readSafeStatus };

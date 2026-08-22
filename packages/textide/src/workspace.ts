import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import type { TextUIApp, BindingPath } from '@textui/core';

/**
 * The workspace, and the file that describes it.
 *
 * `.textide.json` is read once at boot and put in the store, so every part of
 * the application reads its settings the same way it reads everything else.
 * A workspace without one is not an error - the defaults are the answer, and
 * an editor that refuses to open a directory until it is configured is an
 * editor nobody opens.
 */

export const WORKSPACE_PATH = '$/app/workspace' as BindingPath;
export const CONFIG_FILE = '.textide.json';

export interface WorkspaceConfig {
  /** Shown in the titlebar. Defaults to the directory name. */
  name?: string;
  theme?: string;
  /** Start with the sidebar collapsed. */
  sidebarCollapsed?: boolean;
  /** List dotfiles. */
  hidden?: boolean;
  /** Names the explorer never lists. */
  exclude?: string[];
  /** Refuse every write, whatever the filesystem permits. */
  readonly?: boolean;
  /** Spaces per indent level, for the editor. */
  tabWidth?: number;
  /** How diffs are laid out: one column, or before and after side by side. */
  diff?: 'unified' | 'split';
  /** How the editor groups are arranged: tabs, a split or a stack. */
  layout?: 'tabs' | 'split' | 'stack';
  /**
   * Modules to load into the application at boot.
   *
   * A path, relative to the workspace, or a package name resolved from the
   * workspace's own `node_modules`. Each one exports
   * `activate(app, context)` and returns a `Disposable`.
   */
  extensions?: string[];
  /**
   * Extensions textide loads by itself when the workspace warrants it - git in
   * a repository, so far.
   *
   * On unless it is turned off. An editor opened in a repository that says
   * nothing about git is an editor that has decided not to mention the branch
   * you are on, and that is a stranger default than loading it.
   */
  builtinExtensions?: boolean;
}

export interface Workspace extends WorkspaceConfig {
  /** Absolute path of the directory that was opened. */
  root: string;
  /** `file://` form of `root`, which is what the explorer browses. */
  rootUri: string;
  /** Whether a config file was found, so the UI can say so. */
  configured: boolean;
}

const DEFAULTS: Required<Pick<WorkspaceConfig, 'theme' | 'tabWidth' | 'hidden' | 'readonly'>> = {
  theme: 'paper-dark',
  tabWidth: 2,
  hidden: false,
  readonly: false,
};

export async function loadWorkspace(dir: string): Promise<Workspace> {
  const root = resolve(dir);
  let config: WorkspaceConfig = {};
  let configured = false;

  try {
    config = JSON.parse(await readFile(resolve(root, CONFIG_FILE), 'utf8')) as WorkspaceConfig;
    configured = true;
  } catch {
    // No config, or one that is not JSON. Either way the defaults apply -
    // reporting it here would be a dialog before the first frame.
  }

  return {
    ...DEFAULTS,
    ...config,
    name: config.name ?? basename(root) ?? root,
    root,
    rootUri: new URL(`file://${root}`).href,
    configured,
  };
}

/**
 * Put the workspace where every component reads it from.
 *
 * The config is set every time, because it is what the file says. The UI state
 * it *seeds* is only written when nothing has filled it in - the same rule
 * `useStore` follows - so registering again, which is what a hot reload does,
 * does not fold up a sidebar somebody opened.
 */
export function seedWorkspace(app: TextUIApp, workspace: Workspace): void {
  app.store.set(WORKSPACE_PATH, workspace);
  if (app.store.get('$/ui/sidebar/collapsed') === undefined) {
    app.store.set('$/ui/sidebar/collapsed', workspace.sidebarCollapsed === true);
  }
}

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { BindingPath, Disposable, TextUIApp } from '@textui/core';
import { createBag } from '@textui/core';
import { CONFIG_FILE, type Workspace, type WorkspaceConfig } from './workspace.js';

/**
 * Settings that stick.
 *
 * A preference you have to set again every morning is not a preference, it is
 * a chore - and the store already holds every one of them, so remembering is a
 * short list of paths and a file.
 *
 * The list is deliberately short. Everything in the store is state, and most
 * of it is state *about right now* - which file is open, where the caret is,
 * which panel has the keyboard. Writing that to a config file would turn a
 * project's settings into a diary. What belongs here is what a person chose on
 * purpose and would choose again.
 */

export interface Remembered {
  path: BindingPath;
  key: keyof WorkspaceConfig;
}

export const REMEMBERED: Remembered[] = [
  { path: '$/ui/theme' as BindingPath, key: 'theme' },
  { path: '$/ui/diff/mode' as BindingPath, key: 'diff' },
  { path: '$/ui/editor/layout' as BindingPath, key: 'layout' },
  { path: '$/ui/sidebar/collapsed' as BindingPath, key: 'sidebarCollapsed' },
];

/** Put what the workspace remembered into the store, before the first frame. */
export function seedSettings(app: TextUIApp, workspace: Workspace): void {
  for (const { path, key } of REMEMBERED) {
    const value = workspace[key];
    // Only what the file actually said. Seeding an absent setting with
    // `undefined` would overwrite whatever the shell had already decided.
    if (value !== undefined) app.store.set(path, value);
  }
}

export interface SaveOptions {
  /** How long to wait after a change before writing. */
  debounceMs?: number;
  /** Injected by a test, so nothing has to touch a disk. */
  write?(config: WorkspaceConfig): Promise<void>;
  onError?(error: unknown): void;
}

/**
 * Write the config file back when one of them changes.
 *
 * Merged into whatever is already there rather than written from the store, so
 * a comment-free field this application has never heard of - an extension's
 * settings, a key added by a later version - survives being saved by this one.
 *
 * Debounced, because dragging a sidebar toggle or stepping through themes in
 * the palette is one decision and not thirty.
 */
export function rememberSettings(
  app: TextUIApp,
  workspace: Workspace,
  options: SaveOptions = {},
): Disposable {
  const bag = createBag();
  const file = join(workspace.root, CONFIG_FILE);
  const wait = options.debounceMs ?? 250;

  const write = options.write ?? (async (config: WorkspaceConfig): Promise<void> => {
    let existing: WorkspaceConfig = {};
    try {
      existing = JSON.parse(await readFile(file, 'utf8')) as WorkspaceConfig;
    } catch {
      // No file yet, or one that is not JSON. A settings save is not the place
      // to report that a config file is broken - it is the place not to make
      // it worse, so what gets written is what we know.
    }
    await writeFile(file, `${JSON.stringify({ ...existing, ...config }, null, 2)}\n`);
  });

  let timer: ReturnType<typeof setTimeout> | null = null;
  const save = (): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const config: WorkspaceConfig = {};
      for (const { path, key } of REMEMBERED) {
        const value = app.store.get(path);
        if (value !== undefined && value !== null) {
          (config as Record<string, unknown>)[key] = value;
        }
      }
      void write(config).catch(options.onError ?? (() => { /* a save nobody asked for */ }));
    }, wait);
    timer.unref?.();
  };

  for (const { path } of REMEMBERED) bag.add(app.store.subscribe(path, save));
  bag.add({ dispose: () => { if (timer) clearTimeout(timer); } });

  return bag;
}

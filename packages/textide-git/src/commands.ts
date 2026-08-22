import type { CommandContext, CommandDefinition, TextUIApp } from '@textui/core';
import { confirm, notify, prompt } from '@textui/core';
import { closeDocument } from '@textui/documents';
import { readBranches, type Git, type Status } from './git.js';
import { safeStatus } from './provider.js';
import { diffUri } from './provider.js';
import { SELECTED_PATH, STATUS_PATH, STATUS_SEGMENTS, summarize } from './changes.js';

/**
 * What git can be asked to do.
 *
 * Every one of them ends in a refresh, because the answer to "what changed"
 * is `git status` and not a guess about what the last command must have done
 * to it. Refreshing is one process spawn and it is right every time, including
 * when somebody committed in another window.
 */

/** Where the editor publishes what it has open. Read, never written. */
const EDITOR_URI = '$/ui/editor/uri';

/** Re-read the status and publish it, along with the status bar segment. */
export async function refresh(app: TextUIApp, git: Git): Promise<Status | null> {
  const status = await safeStatus(git);
  app.store.set(STATUS_PATH, status);

  const segment = summarize(status);
  const current = app.store.get<{ id: string }[]>(STATUS_SEGMENTS) ?? [];
  const rest = current.filter((s) => s.id !== 'git');
  app.store.set(STATUS_SEGMENTS, segment ? [...rest, segment] : rest);

  // A selection that is not in the list any more is a row nothing highlights,
  // and a diff command that acts on a path git has stopped mentioning.
  const selected = app.store.get<string>(SELECTED_PATH);
  if (selected && !status?.changes.some((c) => c.path === selected)) {
    app.store.set(SELECTED_PATH, status?.changes[0]?.path ?? null);
  }
  return status;
}

/** The path a command acts on: the argument, then the panel's selection. */
function target(args: Record<string, unknown>, ctx: CommandContext): string | null {
  const explicit = args.path;
  if (typeof explicit === 'string' && explicit !== '') return explicit;
  const selected = ctx.store.get<string>(SELECTED_PATH);
  return typeof selected === 'string' && selected !== '' ? selected : null;
}

export interface CommandOptions {
  git: Git;
  /** Absolute path of the working tree, for turning a URI back into a path. */
  root: string;
}

export function gitCommands(app: TextUIApp, options: CommandOptions): CommandDefinition[] {
  const { git } = options;
  const status = (): Status | null => app.store.get<Status>(STATUS_PATH) ?? null;

  return [
    {
      id: 'git.refresh',
      title: 'Refresh',
      category: 'Git',
      slots: ['palette'],
      run: async () => { await refresh(app, git); },
    },
    {
      id: 'git.diff',
      title: 'Open Diff',
      category: 'Git',
      slots: ['palette'],
      description: 'Show what is not committed for one path',
      args: [{ name: 'path', type: 'string' as const }],
      run: async (args: Record<string, unknown>, ctx: CommandContext) => {
        const path = target(args, ctx);
        if (!path) {
          notify(ctx.app, { message: 'Nothing selected.' });
          return;
        }
        const uri = diffUri(path);
        /*
         * The buffer is dropped before the tab opens, because a diff is a
         * question about right now: leaving the old one would show the diff
         * from before you staged, and `openDocument` prefers the buffer it has
         * over re-reading, which is right for a file and wrong for this.
         */
        closeDocument(ctx.store, uri);
        ctx.store.set(EDITOR_URI, uri);
      },
    },
    {
      id: 'git.stage',
      title: 'Stage',
      category: 'Git',
      slots: ['palette'],
      args: [{ name: 'path', type: 'string' as const }],
      run: async (args: Record<string, unknown>, ctx: CommandContext) => {
        const path = target(args, ctx);
        if (!path) return;
        await git('add', '--', path);
        await refresh(ctx.app, git);
        notify(ctx.app, { tone: 'success', message: `Staged ${path}` });
      },
    },
    {
      id: 'git.unstage',
      title: 'Unstage',
      category: 'Git',
      slots: ['palette'],
      args: [{ name: 'path', type: 'string' as const }],
      run: async (args: Record<string, unknown>, ctx: CommandContext) => {
        const path = target(args, ctx);
        if (!path) return;
        await git('restore', '--staged', '--', path);
        await refresh(ctx.app, git);
        notify(ctx.app, { message: `Unstaged ${path}` });
      },
    },
    {
      id: 'git.stageAll',
      title: 'Stage All',
      category: 'Git',
      slots: ['palette'],
      run: async (_args: Record<string, unknown>, ctx: CommandContext) => {
        await git('add', '--all');
        await refresh(ctx.app, git);
      },
    },
    {
      id: 'git.commit',
      title: 'Commit',
      category: 'Git',
      slots: ['palette'],
      run: async (_args: Record<string, unknown>, ctx: CommandContext) => {
        const staged = status()?.changes.filter((c) => c.staged) ?? [];
        if (staged.length === 0) {
          // Committing nothing is not an error git reports usefully, and
          // "stage something first" is the whole of what went wrong.
          notify(ctx.app, { tone: 'warning', message: 'Nothing staged.' });
          return;
        }
        const message = await prompt(ctx.app.layers, {
          title: 'Commit',
          message: `${staged.length} file${staged.length === 1 ? '' : 's'} staged`,
        });
        if (!message) return;
        await git('commit', '-m', message);
        await refresh(ctx.app, git);
        notify(ctx.app, { tone: 'success', message: 'Committed.' });
      },
    },
    {
      id: 'git.branch',
      title: 'Switch Branch',
      category: 'Git',
      slots: ['palette'],
      // The command says what it needs and whatever is asking - the palette, a
      // submenu - reads the choices off it rather than keeping its own list.
      args: [{
        name: 'name', type: 'string' as const, required: true,
        choices: () => readBranches(git).catch(() => []),
      }],
      run: async (args: Record<string, unknown>, ctx: CommandContext) => {
        const name = String(args.name ?? '');
        if (!name || name === status()?.branch) return;
        // Switching with changes in the tree is how work gets lost, and git
        // will refuse anyway - asking first turns a raw git error into a
        // question with a way out.
        if ((status()?.changes.length ?? 0) > 0) {
          const ok = await confirm(ctx.app.layers, {
            title: 'Switch Branch',
            message: `There are uncommitted changes. Switch to ${name}?`,
            confirmLabel: 'Switch',
            tone: 'warning',
          });
          if (!ok) return;
        }
        await git('switch', name);
        await refresh(ctx.app, git);
        notify(ctx.app, { tone: 'success', message: `On ${name}` });
      },
    },
  ];
}

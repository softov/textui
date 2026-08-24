import { rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { BindingPath, CommandContext, CommandDefinition, TextUIApp } from '@textui/core';
import { confirm, notify, prompt } from '@textui/widgets';
import { closeDocument } from '@textui/documents';
import { readBranches, type Git, type Status } from './git.js';
import { safeStatus } from './provider.js';
import { blameUri, diffUri, logUri } from './provider.js';
import { SELECTED_PATH, STATUS_PATH, STATUS_SEGMENTS, summarize } from './changes.js';
import { DIFF_MODE } from './diff.js';
import { parseHunks, patchFor } from './hunks.js';

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
// Where the explorer publishes its highlight. A store path rather than an
// import, because textide-git is loaded by textide and must not depend on it.
const ACTIVE_RESOURCE = '$/active/resource';

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

/**
 * A `file://` URI as a path relative to the working tree, or null if it is
 * not inside it.
 *
 * Everything textide publishes about "the current thing" is a URI and git
 * speaks in repository-relative paths, so this is the one place that
 * translation lives.
 */
function pathIn(root: string, uri: unknown): string | null {
  if (typeof uri !== 'string' || uri === '') return null;
  const base = root.endsWith('/') ? root.slice(0, -1) : root;
  const prefix = `file://${base}/`;
  return uri.startsWith(prefix) ? uri.slice(prefix.length) : null;
}

/**
 * The path a command acts on.
 *
 * Four places, in the order a person means them: what the caller passed, the
 * file open in front of you, the row the explorer is standing on, and the
 * Source Control selection last.
 *
 * It used to be the argument and the Source Control selection, full stop -
 * so `git.diff`, `git.stage`, `git.unstage` and `git.log` all answered
 * "Nothing selected." when invoked from the explorer or from an open file,
 * which is where they are actually invoked from. `git.blame` was the only one
 * that fell back to the open file, and it did it at its own call site.
 */
function targetOf(
  args: Record<string, unknown>,
  ctx: CommandContext,
  root: string,
): string | null {
  const explicit = args.path;
  if (typeof explicit === 'string' && explicit !== '') return explicit;

  const open = pathIn(root, ctx.store.get<string>(EDITOR_URI as BindingPath));
  if (open !== null) return open;

  const active = pathIn(root, ctx.store.get<string>(`${ACTIVE_RESOURCE}/uri` as BindingPath));
  if (active !== null) return active;

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
  const target = (args: Record<string, unknown>, ctx: CommandContext): string | null =>
    targetOf(args, ctx, options.root);
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
      /*
       * Show me git.
       *
       * Loading in a repository without being asked means the panel cannot
       * open itself as well - an editor that rearranges its own screen because
       * a directory happens to be a repository is doing too much. So it
       * registers quietly and this is the key that brings it out, which is
       * also the moment to make sure what it shows is current.
       */
      id: 'git.show',
      title: 'Source Control',
      category: 'Git',
      slots: ['palette'],
      run: async (_args: Record<string, unknown>, ctx: CommandContext) => {
        ctx.store.set('$/ui/aside/visible', true);
        await refresh(app, git);
      },
    },
    {
      /*
       * How a diff is laid out, which is a preference and not an argument to
       * one command: it is stored, so every diff on screen changes together
       * and the next one opens the way the last one was left.
       */
      id: 'git.diffMode',
      title: 'Diff Layout',
      category: 'Git',
      slots: ['palette'],
      args: [{
        name: 'mode',
        type: 'string' as const,
        required: true,
        description: 'How to lay a diff out',
        choices: () => ['unified', 'split'],
      }],
      run: (args: Record<string, unknown>, ctx: CommandContext) => {
        const mode = args.mode === 'split' ? 'split' : 'unified';
        ctx.store.set(DIFF_MODE, mode);
      },
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
      /*
       * One hunk, rather than the whole file.
       *
       * A working copy usually holds two or three unrelated edits and a commit
       * should hold one of them. Git can already do this - `apply --cached`
       * puts a patch in the index and nowhere else - so this cuts one hunk out
       * of the diff and hands it back as a patch of its own.
       *
       * Through a file rather than a pipe: `git apply` takes a path, and a
       * temporary file is a smaller thing to get right than a stdin contract
       * threaded through an injectable `exec`.
       */
      id: 'git.stageHunk',
      title: 'Stage Hunk',
      category: 'Git',
      slots: ['palette'],
      args: [
        { name: 'path', type: 'string' as const },
        { name: 'hunk', type: 'number' as const, description: 'Which one, counting from zero' },
        { name: 'reverse', type: 'boolean' as const, description: 'Take it back out again' },
      ],
      run: async (args: Record<string, unknown>, ctx: CommandContext) => {
        const path = target(args, ctx);
        if (!path) return;

        const reverse = args.reverse === true;
        // Staged hunks are read out of the index, not the working tree: taking
        // one back out means diffing what is already there.
        const raw = reverse
          ? await git.lenient('diff', '--no-color', '--cached', '--', path)
          : await git.lenient('diff', '--no-color', '--', path);
        const diff = parseHunks(raw);
        const at = typeof args.hunk === 'number' ? args.hunk : 0;
        const patch = patchFor(diff, at);
        if (!patch) {
          notify(ctx.app, { message: 'Nothing to stage there.' });
          return;
        }

        const file = join(tmpdir(), `textide-hunk-${process.pid}-${diff.hunks.length}.patch`);
        try {
          await writeFile(file, patch);
          await git('apply', '--cached', ...(reverse ? ['--reverse'] : []), '--unidiff-zero', file);
          await refresh(ctx.app, git);
          notify(ctx.app, {
            tone: 'success',
            message: reverse ? 'Hunk unstaged.' : 'Hunk staged.',
          });
        } catch (error) {
          // A hunk that will not apply is the interesting case: the file moved
          // under the diff, so say so rather than leaving a silent no-op.
          notify(ctx.app, { tone: 'danger', message: `Could not apply: ${String(error)}` });
        } finally {
          await rm(file, { force: true });
        }
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
      /*
       * What happened - to the repository, or to one path.
       *
       * A resource, so it opens as a tab through the registry like a diff
       * does. The alternative was a panel with its own scrolling and its own
       * keys, which is a second editor for text that is already text.
       */
      id: 'git.log',
      title: 'History',
      category: 'Git',
      slots: ['palette'],
      args: [{ name: 'path', type: 'string' as const, description: 'One path, or all of it' }],
      run: async (args: Record<string, unknown>, ctx: CommandContext) => {
        const path = typeof args.path === 'string' ? args.path : '';
        ctx.store.set(EDITOR_URI as BindingPath, logUri(path));
      },
    },
    {
      id: 'git.blame',
      title: 'Blame',
      category: 'Git',
      slots: ['palette'],
      args: [{ name: 'path', type: 'string' as const }],
      run: async (args: Record<string, unknown>, ctx: CommandContext) => {
        // The file you are looking at, when nothing says otherwise - blaming
        // the panel's selection is what a person means by "who wrote this".
        const path = target(args, ctx);
        if (path === null) {
          notify(ctx.app, { message: 'Nothing to blame.' });
          return;
        }
        ctx.store.set(EDITOR_URI as BindingPath, blameUri(path));
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

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderApp } from '@textui/testing';
import { decorationsPath, lineMarksFor, registerBuiltins } from '@textui/core';
import { registerDocuments } from '@textui/documents';
import {
  classify, codeOf, createGit, decorationsOf, diffPath, diffUri, parseStatus, readDiff,
  readStatus, registerGit, summarize, marksOf, pairsOf,
  DIFF_MODE, GIT_SOURCE, STATUS_PATH, SELECTED_PATH,
} from '../src/index.js';
import type { Change, Status } from '../src/index.js';

const run = promisify(execFile);

/**
 * Git, against a real repository.
 *
 * Parsing is checked against strings, because the porcelain has cases nobody
 * would produce on purpose - a rename spends two records, a path may contain a
 * newline. Everything else is checked against a repository that actually
 * exists, because the value of this package is that what it says agrees with
 * what `git status` says.
 */

let dir: string;

async function git(...args: string[]): Promise<void> {
  await run('git', args, { cwd: dir });
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'textide-git-'));
  await git('init', '-b', 'main');
  await git('config', 'user.email', 'test@example.com');
  await git('config', 'user.name', 'Test');
  await git('config', 'commit.gpgsign', 'false');
  await writeFile(join(dir, 'tracked.txt'), 'one\ntwo\n');
  await git('add', '.');
  await git('commit', '-m', 'first');
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('reading the porcelain', () => {
  it('takes the branch, the drift and the two columns apart', () => {
    const status = parseStatus(
      '## main...origin/main [ahead 2, behind 1]\0'
      + 'M  staged.ts\0'
      + ' M unstaged.ts\0'
      + 'MM both.ts\0'
      + '?? new.ts\0',
    );
    expect(status.branch).toBe('main');
    expect(status.ahead).toBe(2);
    expect(status.behind).toBe(1);
    expect(status.clean).toBe(false);

    const by = (path: string) => status.changes.find((c) => c.path === path);
    expect(by('staged.ts')).toMatchObject({ staged: true, unstaged: false });
    expect(by('unstaged.ts')).toMatchObject({ staged: false, unstaged: true });
    expect(by('both.ts')).toMatchObject({ staged: true, unstaged: true });
    expect(by('new.ts')).toMatchObject({ untracked: true, staged: false, unstaged: true });
  });

  /**
   * A rename spends two NUL records: the new path, then the old one. Reading
   * it as two changes is how a rename turns into a phantom file.
   */
  it('reads a rename as one change that knows where it came from', () => {
    const status = parseStatus('## main\0R  new.ts\0old.ts\0');
    expect(status.changes).toHaveLength(1);
    expect(status.changes[0]).toMatchObject({ path: 'new.ts', from: 'old.ts', staged: true });
  });

  it('says nothing about a branch that is not one', () => {
    const status = parseStatus('## HEAD (no branch)\0');
    expect(status.branch).toBe(null);
    expect(status.clean).toBe(true);
  });

  it('reports a clean tree as clean', async () => {
    const status = await readStatus(createGit({ root: dir }));
    expect(status.branch).toBe('main');
    expect(status.clean).toBe(true);
  });
});

describe('against a repository', () => {
  it('sees a change, and stops seeing it once it is committed', async () => {
    const g = createGit({ root: dir });
    await writeFile(join(dir, 'tracked.txt'), 'one\ntwo\nthree\n');
    let status = await readStatus(g);
    expect(status.changes.map((c) => c.path)).toContain('tracked.txt');
    expect(status.changes[0]?.unstaged).toBe(true);

    await git('add', 'tracked.txt');
    status = await readStatus(g);
    expect(status.changes[0]?.staged).toBe(true);

    await git('commit', '-m', 'third line');
    expect((await readStatus(g)).clean).toBe(true);
  });

  /**
   * `git diff` exits 1 to mean "there are differences", which is the answer
   * and not a failure. A wrapper that only reads stdout on exit zero turns
   * every diff into an empty one.
   */
  it('reads a diff even though git exits non-zero to produce one', async () => {
    const g = createGit({ root: dir });
    await writeFile(join(dir, 'tracked.txt'), 'one\nCHANGED\nthree\n');
    const diff = await readDiff(g, 'tracked.txt');
    expect(diff).toContain('+CHANGED');
    expect(diff).toContain('-two');
    await git('checkout', '--', 'tracked.txt');
  });

  it('shows an untracked file as one long addition', async () => {
    const g = createGit({ root: dir });
    await writeFile(join(dir, 'fresh.txt'), 'brand new\n');
    const status = await readStatus(g);
    const change = status.changes.find((c) => c.path === 'fresh.txt');
    expect(change?.untracked).toBe(true);

    const diff = await readDiff(g, 'fresh.txt', true);
    expect(diff).toContain('+brand new');
    await rm(join(dir, 'fresh.txt'));
  });

  it('never spawns a shell, so a branch name is a name', async () => {
    const asked: string[][] = [];
    const g = createGit({
      root: dir,
      exec: (args) => { asked.push(args); return Promise.resolve('## main\0'); },
    });
    await readStatus(g);
    expect(asked[0]).toEqual(['status', '--porcelain=v1', '-b', '-z']);
  });
});

describe('a diff is a resource', () => {
  it('round-trips a path through a URI, however it is spelt', () => {
    for (const path of ['src/index.ts', 'a b/c#d.ts', 'weird?name.txt']) {
      expect(diffPath(diffUri(path))).toBe(path);
    }
    expect(diffPath('file:///tmp/x')).toBe(null);
  });

  it('knows what each line of a diff does', () => {
    expect(classify('@@ -1,3 +1,4 @@')).toBe('hunk');
    expect(classify('+++ b/x.ts')).toBe('meta');
    expect(classify('--- a/x.ts')).toBe('meta');
    expect(classify('+added')).toBe('add');
    expect(classify('-removed')).toBe('remove');
    expect(classify(' context')).toBe('context');
  });
});

describe('what it says in one line', () => {
  it('names the branch, the drift and the count', () => {
    expect(summarize({
      branch: 'main', ahead: 2, behind: 1, clean: false,
      changes: [{ path: 'a', index: 'M', work: ' ', staged: true, unstaged: false, untracked: false }],
    })?.label).toBe('main +2 -1 1 changed');
    expect(summarize({ branch: 'main', ahead: 0, behind: 0, changes: [], clean: true })?.label)
      .toBe('main');
    expect(summarize(null)).toBe(null);
  });

  it('shows the two porcelain columns as git prints them', () => {
    expect(codeOf({ path: 'a', index: 'M', work: ' ', staged: true, unstaged: false, untracked: false }))
      .toBe('M·');
    expect(codeOf({ path: 'a', index: '?', work: '?', staged: false, unstaged: true, untracked: true }))
      .toBe('??');
  });
});

describe('loading and unloading', () => {
  async function mounted() {
    const t = await renderApp({
      width: 100, height: 20, shell: 'workbench', theme: 'workbench',
      onBoot: (app) => { registerBuiltins(app); registerDocuments(app); },
    });
    const quiet = async (): Promise<void> => {
      for (let i = 0; i < 10; i++) { await t.settle(); t.advance(50); t.flush(); }
    };
    await quiet();
    return { t, quiet };
  }

  it('puts the branch in the status bar and the changes in the aside', async () => {
    const { t, quiet } = await mounted();
    await writeFile(join(dir, 'tracked.txt'), 'one\ntwo\nfour\n');
    const bag = registerGit(t.app, { root: dir });
    await quiet();

    expect(t.app.store.get<{ branch: string }>(STATUS_PATH)?.branch).toBe('main');
    expect(t.hasText('tracked.txt'), 'the panel lists it').toBe(true);
    expect(t.hasText('main'), 'the status bar names the branch').toBe(true);

    bag.dispose();
    await quiet();
    expect(t.hasText('tracked.txt'), 'and takes it away again').toBe(false);
    await git('checkout', '--', 'tracked.txt');
    await t.unmount();
  });

  /**
   * The test the extension point exists to pass. If unloading git left a
   * viewer, a command or a segment behind, the boundary would be in the wrong
   * place - and loading it twice would then be a different screen from loading
   * it once.
   */
  it('leaves nothing behind, however many times it is loaded', async () => {
    const { t, quiet } = await mounted();
    const commands = t.app.commands.list().length;
    const components = t.app.components.list().length;
    const bindings = t.app.keybindings.list().length;

    for (let i = 0; i < 3; i++) {
      const bag = registerGit(t.app, { root: dir });
      await quiet();
      expect(t.app.commands.list().length).toBeGreaterThan(commands);
      bag.dispose();
      await quiet();
      expect(t.app.commands.list().length, 'commands').toBe(commands);
      expect(t.app.components.list().length, 'components').toBe(components);
      expect(t.app.keybindings.list().length, 'keybindings').toBe(bindings);
    }
    await t.unmount();
  });

  it('opens a diff as a tab through the registry', async () => {
    const { t, quiet } = await mounted();
    await writeFile(join(dir, 'tracked.txt'), 'one\nDIFFERENT\n');
    const bag = registerGit(t.app, { root: dir });
    await quiet();

    t.app.store.set(SELECTED_PATH, 'tracked.txt');
    await t.app.execute('git.diff');
    await quiet();
    expect(t.app.store.get('$/ui/editor/uri')).toBe(diffUri('tracked.txt'));

    // The registry, not this test, decides what opens it.
    const resource = await t.app.resources.stat(diffUri('tracked.txt'));
    expect(resource?.kind).toBe('git.diff');
    expect(resource?.capabilities).toEqual(['read']);

    bag.dispose();
    await git('checkout', '--', 'tracked.txt');
    await t.unmount();
  });

  it('stages and unstages what the panel has selected', async () => {
    const { t, quiet } = await mounted();
    await writeFile(join(dir, 'tracked.txt'), 'one\nSTAGE ME\n');
    const bag = registerGit(t.app, { root: dir });
    await quiet();

    t.app.store.set(SELECTED_PATH, 'tracked.txt');
    await t.app.execute('git.stage');
    await quiet();
    expect(t.app.store.get<{ changes: { staged: boolean }[] }>(STATUS_PATH)?.changes[0]?.staged)
      .toBe(true);

    await t.app.execute('git.unstage');
    await quiet();
    expect(t.app.store.get<{ changes: { staged: boolean }[] }>(STATUS_PATH)?.changes[0]?.staged)
      .toBe(false);

    bag.dispose();
    await git('checkout', '--', 'tracked.txt');
    await t.unmount();
  });
});

/**
 * Git in the file tree.
 *
 * The explorer knows nothing about git; it draws whatever marks were published
 * for a URI. So the whole of "show me what changed without leaving the file
 * list" is a status turned into marks, and this is that turn.
 */
describe('marks on the tree', () => {
  async function mounted() {
    const t = await renderApp({
      width: 100, height: 20, shell: 'workbench', theme: 'workbench',
      onBoot: (app) => { registerBuiltins(app); registerDocuments(app); },
    });
    const quiet = async (): Promise<void> => {
      for (let i = 0; i < 10; i++) { await t.settle(); t.advance(50); t.flush(); }
    };
    await quiet();
    return { t, quiet };
  }

  const status = (changes: Partial<Change>[]): Status => ({
    branch: 'main',
    ahead: 0,
    behind: 0,
    clean: false,
    changes: changes.map((c) => ({
      path: '', index: ' ', work: ' ', staged: false, unstaged: false, untracked: false, ...c,
    })) as Change[],
  });

  it('marks a file with the code git printed', () => {
    const marks = decorationsOf(
      status([{ path: 'a.txt', index: ' ', work: 'M', unstaged: true }]),
      '/repo',
    );
    expect(marks['file:///repo/a.txt']).toEqual({ badge: '·M', tone: 'warning' });
  });

  it('carries it up to every folder above', () => {
    const marks = decorationsOf(
      status([{ path: 'src/deep/a.ts', index: 'A', work: ' ', staged: true }]),
      '/repo',
    );
    // A change three levels down is invisible otherwise, and finding things
    // you have not opened yet is what a file tree is for.
    expect(marks['file:///repo/src']).toEqual({ badge: '·', tone: 'success' });
    expect(marks['file:///repo/src/deep']).toEqual({ badge: '·', tone: 'success' });
    expect(marks['file:///repo/src/deep/a.ts']?.badge).toBe('A·');
  });

  it('gives a folder the loudest of what is under it', () => {
    const marks = decorationsOf(
      status([
        { path: 'src/staged.ts', index: 'A', work: ' ', staged: true },
        { path: 'src/dirty.ts', index: ' ', work: 'M', unstaged: true },
      ]),
      '/repo',
    );
    expect(marks['file:///repo/src']?.tone).toBe('warning');
  });

  it('says nothing about a clean tree', () => {
    expect(decorationsOf(status([]), '/repo')).toEqual({});
    expect(decorationsOf(null, '/repo')).toEqual({});
  });

  it('publishes them whenever the status changes, and takes them back', async () => {
    const { t, quiet } = await mounted();
    await writeFile(join(dir, 'tracked.txt'), 'one\nchanged\n');
    const bag = registerGit(t.app, { root: dir });
    await quiet();

    const published = (): Record<string, unknown> =>
      t.app.store.get<Record<string, unknown>>(decorationsPath(GIT_SOURCE)) ?? {};
    expect(Object.keys(published()).length, 'the working tree is dirty').toBeGreaterThan(0);

    // Unloading git leaves no marks behind. A tree still showing what an
    // unloaded extension thought is worse than a tree showing nothing.
    bag.dispose();
    await quiet();
    expect(t.app.store.get(decorationsPath(GIT_SOURCE))).toBeFalsy();

    await git('checkout', '--', 'tracked.txt');
    await t.unmount();
  });
});

/**
 * Git in the gutter.
 *
 * A unified diff already says which lines moved, so reading the hunk headers
 * is the whole job. The editor draws the column and has never heard of git.
 */
describe('marks in the gutter', () => {
  async function mounted() {
    const t = await renderApp({
      width: 100, height: 20, shell: 'workbench', theme: 'workbench',
      onBoot: (app) => { registerBuiltins(app); registerDocuments(app); },
    });
    const quiet = async (): Promise<void> => {
      for (let i = 0; i < 10; i++) { await t.settle(); t.advance(50); t.flush(); }
    };
    await quiet();
    return { t, quiet };
  }

  it('reads a hunk that adds', () => {
    expect(marksOf('@@ -3,0 +4,2 @@\n+one\n+two\n'))
      .toEqual({ 3: 'added', 4: 'added' });
  });

  it('reads a hunk that changes', () => {
    expect(marksOf('@@ -4,2 +4,2 @@\n-old\n-old\n+new\n+new\n'))
      .toEqual({ 3: 'changed', 4: 'changed' });
  });

  it('puts a deletion on the line above the gap it left', () => {
    // There is no line to mark, so the mark goes where the line was.
    expect(marksOf('@@ -7,3 +6,0 @@\n-gone\n-gone\n-gone\n'))
      .toEqual({ 5: 'removed' });
  });

  it('takes a missing count to mean one line', () => {
    expect(marksOf('@@ -2 +2 @@\n-old\n+new\n')).toEqual({ 1: 'changed' });
  });

  it('says nothing about a file with no diff', () => {
    expect(marksOf('')).toEqual({});
  });

  it('marks the file that is open, and nothing else', async () => {
    const { t, quiet } = await mounted();
    await writeFile(join(dir, 'tracked.txt'), 'one\nCHANGED\nthree\n');
    const bag = registerGit(t.app, { root: dir });
    await quiet();

    const uri = `file://${join(dir, 'tracked.txt')}`;
    t.app.store.set('$/ui/editor/uri', uri);
    await quiet();
    expect(lineMarksFor(t.app.store, uri), 'the changed line').toEqual({ 1: 'changed' });

    // A file git is not tracking gets no column at all, rather than a column
    // of spaces.
    const other = `file://${join(dir, 'untracked-nothing.txt')}`;
    t.app.store.set('$/ui/editor/uri', other);
    await quiet();
    expect(lineMarksFor(t.app.store, other)).toEqual({});

    bag.dispose();
    await quiet();
    expect(lineMarksFor(t.app.store, uri)).toEqual({});
    await git('checkout', '--', 'tracked.txt');
    await t.unmount();
  });
});

/**
 * A diff, both ways.
 *
 * Unified is what git prints and reads well in a narrow pane. Split is what
 * you want when lines *changed* rather than arrived, because the two versions
 * of a line end up on the same row.
 */
describe('two ways to read a diff', () => {
  async function mounted() {
    const t = await renderApp({
      width: 100, height: 20, shell: 'workbench', theme: 'workbench',
      onBoot: (app) => { registerBuiltins(app); registerDocuments(app); },
    });
    const quiet = async (): Promise<void> => {
      for (let i = 0; i < 10; i++) { await t.settle(); t.advance(50); t.flush(); }
    };
    await quiet();
    return { t, quiet };
  }

  const lines = (s: string): string[] => s.split('\n');

  it('pairs a removal with the addition that replaced it', () => {
    const pairs = pairsOf(lines('@@ -1,2 +1,2 @@\n-old one\n-old two\n+new one\n+new two\n'));
    expect(pairs[0]?.full?.kind).toBe('hunk');
    expect(pairs[1]).toEqual({
      left: { text: '-old one', kind: 'remove' },
      right: { text: '+new one', kind: 'add' },
    });
    expect(pairs[2]?.right).toEqual({ text: '+new two', kind: 'add' });
  });

  it('leaves a gap opposite a line that only went, or only arrived', () => {
    const gone = pairsOf(lines('-only\n'));
    expect(gone[0]).toEqual({ left: { text: '-only', kind: 'remove' }, right: null });

    const came = pairsOf(lines('+only\n'));
    expect(came[0]).toEqual({ left: null, right: { text: '+only', kind: 'add' } });
  });

  it('puts context on both sides, because it is on both sides', () => {
    const pairs = pairsOf([' same']);
    expect(pairs[0]?.left).toEqual({ text: ' same', kind: 'context' });
    expect(pairs[0]?.right).toEqual({ text: ' same', kind: 'context' });
  });

  it('pairs the runs even when the removal came after the addition it replaces', () => {
    // git prints removals first within a hunk, but a diff assembled elsewhere
    // may not - and a run that starts with additions still has to pair up.
    const pairs = pairsOf(lines('+new\n-old\n'));
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toEqual({
      left: { text: '-old', kind: 'remove' },
      right: { text: '+new', kind: 'add' },
    });
  });

  it('switches every diff on screen at once', async () => {
    const { t, quiet } = await mounted();
    const bag = registerGit(t.app, { root: dir });
    await quiet();

    await t.app.execute('git.diffMode', { mode: 'split' });
    await quiet();
    expect(t.app.store.get(DIFF_MODE)).toBe('split');

    bag.dispose();
    await t.unmount();
  });
});

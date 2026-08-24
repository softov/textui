import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderApp } from '@textui/testing';
import { DECORATIONS_ROOT } from '@textui/widgets';
import { loadExtensions, loadWorkspace, registerTextide } from '../src/index.js';

/**
 * What textide brings without being asked.
 *
 * Git, in a repository. It arrives through the extension point like anything
 * else - nothing in textide imports it, and unloading takes every part of it
 * back out - but a person who opens an editor inside a repository should not
 * have to write a config file to be told which branch they are on.
 */

let repo: string;
let plain: string;

beforeAll(async () => {
  repo = await mkdtemp(join(tmpdir(), 'textide-repo-'));
  execFileSync('git', ['init', '-q'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 'nobody@example.com'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'Nobody'], { cwd: repo });
  await writeFile(join(repo, 'tracked.txt'), 'one\n');
  execFileSync('git', ['add', '.'], { cwd: repo });
  execFileSync('git', ['commit', '-qm', 'first'], { cwd: repo });
  await writeFile(join(repo, 'tracked.txt'), 'one\ntwo\n');

  plain = await mkdtemp(join(tmpdir(), 'textide-plain-'));
  await writeFile(join(plain, 'a.txt'), 'alpha\n');
});

afterAll(async () => {
  await rm(repo, { recursive: true, force: true });
  await rm(plain, { recursive: true, force: true });
});

async function open(root: string, config: Record<string, unknown> = {}) {
  const workspace = { ...(await loadWorkspace(root)), ...config };
  const t = await renderApp({
    width: 110, height: 22, shell: 'workbench', theme: 'workbench',
    onBoot: (app) => registerTextide(app, { workspace }),
  });
  const quiet = async (): Promise<void> => {
    for (let i = 0; i < 12; i++) { await t.settle(); t.advance(50); t.flush(); }
  };
  await quiet();
  const bag = await loadExtensions(t.app, workspace);
  await quiet();
  return { t, quiet, bag };
}

describe('git in a repository', () => {
  it('loads itself, and says so in the status bar', async () => {
    const { t, bag } = await open(repo);
    expect(t.app.store.get('$/plugins.git/status')).toBeTruthy();
    expect(t.hasText('master'), 'the branch, without a config file').toBe(true);
    bag.dispose();
    await t.unmount();
  });

  it('marks the changed file in the explorer', async () => {
    const { t, bag } = await open(repo);
    // Published under git's own name, so unloading it is one delete and a
    // second contributor is possible.
    const marks = t.store.get<Record<string, Record<string, unknown>>>(DECORATIONS_ROOT);
    expect(Object.keys(marks?.git ?? {}).length).toBeGreaterThan(0);
    // And the explorer draws what it was given, so the mark reaching the
    // screen is the real assertion - the tree has never heard of git.
    expect(t.hasText('·M'), 'the two-column code git printed').toBe(true);
    bag.dispose();
    await t.unmount();
  });

  it('opens no panel by itself, and ctrl+g brings it out', async () => {
    const { t, quiet, bag } = await open(repo);
    // An editor that rearranges its own screen because a directory happens to
    // be a repository is doing too much.
    expect(t.hasText('Source Control'), 'quiet until asked').toBe(false);

    t.press('ctrl+g');
    await quiet();
    expect(t.hasText('Source Control')).toBe(true);
    bag.dispose();
    await t.unmount();
  });

  it('leaves a plain directory alone', async () => {
    const { t, bag } = await open(plain);
    expect(t.app.store.get('$/plugins.git/status')).toBeFalsy();
    expect(t.hasText('Source Control')).toBe(false);
    bag.dispose();
    await t.unmount();
  });

  it('stays out when the workspace says not to', async () => {
    const { t, bag } = await open(repo, { builtinExtensions: false });
    expect(t.app.store.get('$/plugins.git/status')).toBeFalsy();
    bag.dispose();
    await t.unmount();
  });

  it('takes every part of itself back out', async () => {
    const { t, quiet, bag } = await open(repo);
    expect(t.app.commands.get('git.show')).toBeTruthy();

    bag.dispose();
    await quiet();
    expect(t.app.commands.get('git.show')).toBeFalsy();
    expect(t.app.store.get('$/plugins.git/status')).toBeFalsy();
    expect(t.hasText('·M'), 'and no mark it left behind').toBe(false);
    await t.unmount();
  });
});

describe('git in the gutter', () => {
  it('marks the changed lines of the file you are editing', async () => {
    const { t, quiet, bag } = await open(repo);
    t.app.store.set('$/ui/editor/uri', `file://${join(repo, 'tracked.txt')}`);
    await quiet();
    await t.app.execute('file.edit');
    await quiet();

    // `two` was added to a file that had only `one`. The editor draws the
    // column and has never heard of git; git said which lines and stopped.
    const gutterRows = t.lines().filter((l) => /[+~_]\s*\d+ /.test(l));
    expect(gutterRows.length, 'a marked row').toBeGreaterThan(0);
    expect(gutterRows.some((l) => l.includes('+') || l.includes('~'))).toBe(true);

    bag.dispose();
    await t.unmount();
  }, 20_000);
});

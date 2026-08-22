import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  authorWidth, blamePath, blameUri, createGit, logPath, logUri,
  parseBlame, parseLog, readBlame, readLog,
} from '../src/index.js';

/**
 * The log and the blame.
 *
 * Parsing is checked against strings, because git's output has cases nobody
 * would invent - a commit whose subject contains the character you were going
 * to split on, a blame that mentions each commit once and then refers to it -
 * and then once against a real repository, because whether the format flags
 * produce what the parser expects is not a question strings answer.
 */

const run = promisify(execFile);
let dir: string;

async function git(...args: string[]): Promise<void> {
  await run('git', args, { cwd: dir });
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'textide-history-'));
  await git('init', '-b', 'main');
  await git('config', 'user.email', 'test@example.com');
  await git('config', 'user.name', 'Ada Lovelace');

  await writeFile(join(dir, 'f.txt'), 'one\ntwo\n');
  await git('add', '.');
  await git('commit', '-m', 'first: a subject with | a pipe in it');

  await writeFile(join(dir, 'f.txt'), 'one\ntwo\nthree\n');
  await git('add', '.');
  await git('commit', '-m', 'second');
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('reading a log', () => {
  it('splits on something no commit message contains', () => {
    const raw = [
      'aaa\u001fa\u001fAda\u001f2020-01-01T00:00:00Z\u001fsubject | with pipes\u001e',
      'bbb\u001fb\u001fGrace\u001f2020-01-02T00:00:00Z\u001fanother\u001e',
    ].join('');
    // A subject contains every printable character somebody has been annoyed
    // enough to type, so a printable separator is a bug waiting for a commit.
    expect(parseLog(raw)).toEqual([
      { hash: 'aaa', short: 'a', author: 'Ada', date: '2020-01-01T00:00:00Z', subject: 'subject | with pipes' },
      { hash: 'bbb', short: 'b', author: 'Grace', date: '2020-01-02T00:00:00Z', subject: 'another' },
    ]);
  });

  it('says nothing about an empty history', () => {
    expect(parseLog('')).toEqual([]);
  });

  it('reads a real repository, most recent first', async () => {
    const commits = await readLog(createGit({ root: dir }));
    expect(commits.map((c) => c.subject)).toEqual([
      'second', 'first: a subject with | a pipe in it',
    ]);
    expect(commits[0]?.author).toBe('Ada Lovelace');
    expect(commits[0]?.short).toHaveLength(7);
    // ISO, so it sorts and formats without a date library.
    expect(commits[0]?.date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('narrows to one path when asked', async () => {
    const all = await readLog(createGit({ root: dir }), { path: 'f.txt' });
    expect(all).toHaveLength(2);
    const none = await readLog(createGit({ root: dir }), { path: 'nothing.txt' });
    expect(none).toEqual([]);
  });
});

describe('reading a blame', () => {
  it('carries a commit forward rather than repeating it', () => {
    // The porcelain format states each commit once and refers to it by hash
    // after that, which is why the parser has to keep a table.
    const raw = [
      '1111111111111111111111111111111111111111 1 1 2',
      'author Ada',
      'author-time 1577836800',
      'summary first',
      '\tone',
      '1111111111111111111111111111111111111111 2 2',
      '\ttwo',
      '',
    ].join('\n');

    const lines = parseBlame(raw);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatchObject({ author: 'Ada', summary: 'first', text: 'two' });
    expect(lines[0]?.date).toBe('2020-01-01');
    expect(lines[0]?.short).toHaveLength(7);
  });

  it('keeps a line that is only whitespace', () => {
    const raw = [
      '2222222222222222222222222222222222222222 1 1 1',
      'author Grace',
      'author-time 1577836800',
      'summary blank',
      '\t    ',
      '',
    ].join('\n');
    // Everything after the first tab, as it stands - trimming it would be the
    // blame quietly disagreeing with the file.
    expect(parseBlame(raw)[0]?.text).toBe('    ');
  });

  it('reads a real file, one entry per line', async () => {
    const lines = await readBlame(createGit({ root: dir }), 'f.txt');
    expect(lines.map((l) => l.text)).toEqual(['one', 'two', 'three']);
    // The last line came from the second commit; the first two did not.
    expect(lines[0]?.hash).not.toBe(lines[2]?.hash);
    expect(lines[2]?.summary).toBe('second');
  });

  it('measures the author column, capped', () => {
    const lines = parseBlame('');
    expect(authorWidth(lines)).toBe(0);
    expect(authorWidth([{ author: 'a'.repeat(40) } as never])).toBe(14);
  });
});

describe('addressing them', () => {
  it('round-trips a path through a URI', () => {
    expect(logPath(logUri('src/a b.ts'))).toBe('src/a b.ts');
    expect(blamePath(blameUri('src/a b.ts'))).toBe('src/a b.ts');
    // The repository's whole history has no path, and the prefix keeps its
    // slash so that it is still a URI.
    expect(logPath(logUri())).toBe('');
    expect(logPath('git:diff/x')).toBeNull();
    expect(blamePath('git:log/x')).toBeNull();
  });
});

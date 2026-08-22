import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

/**
 * git, as a function that returns text.
 *
 * The porcelain and nothing else: no object model, no libgit binding, no cache
 * that has to be invalidated when somebody commits in another terminal. What
 * `git status` says is what is true, and asking again is cheap enough that
 * being right beats being clever.
 *
 * Every call is `execFile`, never a shell, so a branch called `; rm -rf /` is a
 * branch name and not a sentence.
 */

export interface GitOptions {
  /** The working tree. Every command runs with this as its cwd. */
  root: string;
  /** For a test that wants to see what was asked, or to answer for git. */
  exec?(args: string[], cwd: string): Promise<string>;
}

export class GitError extends Error {
  constructor(message: string, readonly args: string[]) {
    super(message);
    this.name = 'GitError';
  }
}

export interface Git {
  (...args: string[]): Promise<string>;
  /**
   * Run, and take stdout even when the exit code is not zero.
   *
   * `git diff` exits 1 to mean "there are differences", which is not a
   * failure - it is the answer. A wrapper that only ever reads stdout on exit
   * zero turns every diff into an empty one.
   */
  lenient(...args: string[]): Promise<string>;
}

export function createGit(options: GitOptions): Git {
  const exec = options.exec ?? (async (args: string[], cwd: string): Promise<string> => {
    const { stdout } = await run('git', args, { cwd, maxBuffer: 32 * 1024 * 1024 });
    return stdout;
  });

  const call = async (args: string[]): Promise<string> => {
    try {
      return await exec(args, options.root);
    } catch (error) {
      // git says what went wrong on stderr and nowhere else, so an error that
      // loses it is an error nobody can act on.
      const stderr = (error as { stderr?: string }).stderr;
      const failure = new GitError(String(stderr ?? (error as Error).message).trim(), args);
      (failure as GitError & { stdout?: string }).stdout = (error as { stdout?: string }).stdout;
      throw failure;
    }
  };

  const git = ((...args: string[]) => call(args)) as Git;
  git.lenient = async (...args: string[]): Promise<string> => {
    try {
      return await call(args);
    } catch (error) {
      return String((error as { stdout?: string }).stdout ?? '');
    }
  };
  return git;
}

// ----------------------------------------------------------------- status

/**
 * One changed path.
 *
 * `index` and `work` are the two porcelain columns, kept apart rather than
 * folded into one status, because "staged" and "changed since you staged it"
 * are the difference between a commit that is what you meant and one that is
 * not.
 */
export interface Change {
  /** Path relative to the working tree root, as git reports it. */
  path: string;
  /** Where it came from, for a rename. */
  from?: string;
  /** The index column: what is staged. A space means nothing is. */
  index: string;
  /** The worktree column: what is not staged. */
  work: string;
  staged: boolean;
  unstaged: boolean;
  untracked: boolean;
}

export interface Status {
  branch: string | null;
  /** Commits ahead of and behind the upstream, when there is one. */
  ahead: number;
  behind: number;
  changes: Change[];
  /** True when git answered but there is nothing to report. */
  clean: boolean;
}

export const EMPTY_STATUS: Status = {
  branch: null, ahead: 0, behind: 0, changes: [], clean: true,
};

/**
 * Read `status --porcelain=v1 -b -z`.
 *
 * NUL-separated, because a path with a newline in it is legal and the
 * line-separated form quotes it into something that has to be unquoted - two
 * encodings of the same thing, one of which is only exercised by the paths
 * nobody thinks to test.
 */
export function parseStatus(raw: string): Status {
  const records = raw.split('\0');
  let branch: string | null = null;
  let ahead = 0;
  let behind = 0;
  const changes: Change[] = [];

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (record === undefined || record === '') continue;

    if (record.startsWith('## ')) {
      const head = record.slice(3);
      // `main...origin/main [ahead 1, behind 2]`, or `HEAD (no branch)`.
      branch = head.split(/\.{3}| /)[0] ?? null;
      if (branch === 'HEAD' && head.includes('(no branch)')) branch = null;
      ahead = Number(/ahead (\d+)/.exec(head)?.[1] ?? 0);
      behind = Number(/behind (\d+)/.exec(head)?.[1] ?? 0);
      continue;
    }

    const index = record[0] ?? ' ';
    const work = record[1] ?? ' ';
    const path = record.slice(3);
    let from: string | undefined;
    // A rename spends two records: the new path, then the old one.
    if (index === 'R' || work === 'R') {
      from = records[++i] ?? undefined;
    }
    if (path === '') continue;

    const untracked = index === '?' && work === '?';
    changes.push({
      path,
      ...(from ? { from } : {}),
      index,
      work,
      staged: !untracked && index !== ' ',
      unstaged: untracked || work !== ' ',
      untracked,
    });
  }

  return {
    branch,
    ahead,
    behind,
    changes,
    clean: changes.length === 0,
  };
}

export async function readStatus(git: Git): Promise<Status> {
  return parseStatus(await git('status', '--porcelain=v1', '-b', '-z'));
}

/** Whether this directory is inside a working tree at all. */
export async function isRepository(git: Git): Promise<boolean> {
  try {
    return (await git('rev-parse', '--is-inside-work-tree')).trim() === 'true';
  } catch {
    return false;
  }
}

/**
 * The diff of one path against HEAD.
 *
 * Against HEAD rather than against the index, so what is shown is everything
 * that is not committed - which is the question somebody looking at a changed
 * file is asking. An untracked file has no HEAD side, so it is shown as one
 * long addition, which is what it is.
 */
export async function readDiff(git: Git, path: string, untracked = false): Promise<string> {
  // Both of these exit 1 when there is anything to show, so both are lenient.
  return untracked
    ? git.lenient('diff', '--no-index', '--no-color', '--', '/dev/null', path)
    : git.lenient('diff', '--no-color', 'HEAD', '--', path);
}

export async function readBranches(git: Git): Promise<string[]> {
  const raw = await git('branch', '--format=%(refname:short)', '--sort=-committerdate');
  return raw.split('\n').map((line) => line.trim()).filter((line) => line !== '');
}

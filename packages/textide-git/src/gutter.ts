import type { LineMarks } from '@textui/widgets';
import type { Git, Status } from './git.js';

/**
 * Git, in the gutter.
 *
 * The editor draws a column of marks and has never heard of git; this is the
 * half that knows what a mark means. A unified diff already says exactly which
 * lines moved, so the whole job is reading the hunk headers.
 *
 * Only for the file that is open. A repository with fifty changed files would
 * otherwise be fifty processes on every refresh, to answer a question about
 * forty-nine files nobody is looking at.
 */

export const GUTTER_SOURCE = 'git';

/** `@@ -old,count +new,count @@`, where a missing count means one line. */
const HUNK = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

/**
 * Which lines of the working copy differ, counted from zero like an index.
 *
 * A hunk that adds without removing is `added`; one that removes without
 * adding leaves no line to mark, so the mark goes on the line above the gap;
 * anything else is `changed`. Line-by-line attribution inside a hunk is a
 * finer answer than a one-cell column can show.
 */
export function marksOf(diff: string): LineMarks {
  const marks: LineMarks = {};

  for (const line of diff.split('\n')) {
    const found = HUNK.exec(line);
    if (!found) continue;

    const removed = found[2] === undefined ? 1 : Number(found[2]);
    const start = Number(found[3]);
    const added = found[4] === undefined ? 1 : Number(found[4]);

    if (added === 0) {
      // Everything in this hunk went. `start` is the line it went from behind,
      // so the mark sits there rather than on a line that is not there.
      marks[Math.max(0, start - 1)] = 'removed';
      continue;
    }

    const kind = removed === 0 ? 'added' : 'changed';
    for (let i = 0; i < added; i++) marks[start - 1 + i] = kind;
  }

  return marks;
}

/**
 * The marks for one open file, or nothing when git has no opinion about it.
 *
 * `null` rather than an empty object for a file git is not tracking, or one it
 * has nothing to say about: the editor draws no column at all in that case,
 * and an empty object would be a column of spaces.
 */
export async function gutterFor(
  git: Git,
  status: Status | null,
  root: string,
  uri: string | null,
): Promise<LineMarks | null> {
  if (!status || uri === null) return null;

  const base = root.endsWith('/') ? root.slice(0, -1) : root;
  const prefix = `file://${base}/`;
  if (!uri.startsWith(prefix)) return null;

  const path = uri.slice(prefix.length);
  const change = status.changes.find((c) => c.path === path);
  // Not in the status is the common case and the cheap one: a file that has
  // not changed needs no process to prove it.
  if (!change || change.untracked) return null;

  const marks = marksOf(await readDiffOf(git, path));
  return Object.keys(marks).length > 0 ? marks : null;
}

async function readDiffOf(git: Git, path: string): Promise<string> {
  // Exits 1 when there is anything to show, which is why it is the lenient
  // call and not the strict one.
  return git.lenient('diff', '--no-color', '-U0', 'HEAD', '--', path);
}

import type { Git } from './git.js';

/**
 * Where a line came from, and what happened before.
 *
 * Both are read-only views over the repository, and both are *resources* - a
 * log is a thing you open, and so is a blame - which means they arrive in a
 * tab through the registry and the editor never learns that git exists.
 *
 * The parsing is here and the drawing is elsewhere, because the awkward part
 * of both is git's output format and none of it is about rendering.
 */

export interface Commit {
  hash: string;
  /** Seven characters, which is what a person reads and types. */
  short: string;
  author: string;
  /** ISO, so it sorts and formats without a date library. */
  date: string;
  subject: string;
}

/**
 * A separator no commit message contains.
 *
 * Subjects contain every printable character somebody has ever been annoyed
 * enough to type, so splitting on one is a bug waiting for the commit that
 * uses it. A unit separator is not typeable and not in anybody's history.
 */
const FIELD = '\u001f';
const RECORD = '\u001e';

export const LOG_FORMAT = `--format=%H${FIELD}%h${FIELD}%an${FIELD}%aI${FIELD}%s${RECORD}`;

export function parseLog(raw: string): Commit[] {
  return raw
    .split(RECORD)
    .map((record) => record.trim())
    .filter((record) => record !== '')
    .map((record) => {
      const [hash = '', short = '', author = '', date = '', subject = ''] = record.split(FIELD);
      return { hash, short, author, date, subject };
    });
}

export async function readLog(
  git: Git,
  options: { path?: string; limit?: number } = {},
): Promise<Commit[]> {
  const limit = options.limit ?? 200;
  const args = ['log', LOG_FORMAT, `-n${limit}`];
  // `--follow` deliberately not used: it is slow on a large history and it
  // makes the line numbers in a blame stop meaning anything.
  if (options.path !== undefined) args.push('--', options.path);
  return parseLog(await git.lenient(...args));
}

export interface BlameLine {
  /** The commit this line last changed in. */
  hash: string;
  short: string;
  author: string;
  date: string;
  summary: string;
  /** The line itself, as it is in the working copy. */
  text: string;
}

/**
 * `git blame --porcelain`, which is the only form worth parsing.
 *
 * The human format aligns columns and truncates names to fit them, so reading
 * it back means undoing a decision git made about a terminal width it guessed.
 * The porcelain format is a header line, some key/value lines, then the line
 * itself prefixed with a tab - and it states each commit's details once and
 * refers to it by hash after that, which is why this carries a table.
 */
export function parseBlame(raw: string): BlameLine[] {
  const seen = new Map<string, { author: string; date: string; summary: string }>();
  const out: BlameLine[] = [];

  let hash: string | null = null;
  let author = '';
  let date = '';
  let summary = '';

  for (const line of raw.split('\n')) {
    if (line.startsWith('\t')) {
      if (hash === null) continue;
      // Everything after the first tab, which is the line as it stands.
      const text = line.slice(1);
      const known = seen.get(hash);
      if (known) {
        out.push({ hash, short: hash.slice(0, 7), ...known, text });
      } else {
        const details = { author, date, summary };
        seen.set(hash, details);
        out.push({ hash, short: hash.slice(0, 7), ...details, text });
      }
      hash = null;
      continue;
    }

    if (line.startsWith('author ')) { author = line.slice(7); continue; }
    if (line.startsWith('author-time ')) {
      // Seconds, and a timezone on the next line this does not need: the date
      // is shown to be compared, not to be exact about which evening it was.
      date = new Date(Number(line.slice(12)) * 1000).toISOString().slice(0, 10);
      continue;
    }
    if (line.startsWith('summary ')) { summary = line.slice(8); continue; }

    // `<hash> <origLine> <finalLine> [<count>]` opens a group.
    const found = /^([0-9a-f]{40}) \d+ \d+/.exec(line);
    if (found) {
      hash = found[1] as string;
      const known = seen.get(hash);
      if (known) {
        author = known.author;
        date = known.date;
        summary = known.summary;
      }
    }
  }

  return out;
}

export async function readBlame(git: Git, path: string): Promise<BlameLine[]> {
  return parseBlame(await git.lenient('blame', '--porcelain', '--', path));
}

/** How wide the author column has to be, capped so it cannot eat the code. */
export function authorWidth(lines: BlameLine[], cap = 14): number {
  return Math.min(cap, lines.reduce((max, l) => Math.max(max, l.author.length), 0));
}

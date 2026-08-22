/**
 * One hunk at a time.
 *
 * Staging a whole file is the coarse answer, and most of the time the wrong
 * one: a working copy usually holds two or three unrelated edits and a commit
 * should hold one of them. Git already supports this - `git apply --cached`
 * takes a patch and applies it to the index alone - so the whole job is
 * cutting one hunk out of a diff and handing it back as a patch of its own.
 *
 * Nothing here runs a process or touches a file; it is string in, string out,
 * which is what makes it testable against the awkward cases.
 */

export interface Hunk {
  /** `@@ -a,b +c,d @@ …`, as git wrote it. */
  header: string;
  /** The header and its body, ready to be pasted into a patch. */
  lines: string[];
  /** First line of the working copy this hunk covers, counting from one. */
  start: number;
  /** How many lines of the working copy it covers. Zero for a pure deletion. */
  count: number;
}

export interface Diff {
  /** Everything before the first `@@`: `diff --git`, `index`, `---`, `+++`. */
  preamble: string[];
  hunks: Hunk[];
}

const HUNK = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

/** Split a unified diff into the file's header and the hunks under it. */
export function parseHunks(diff: string): Diff {
  const preamble: string[] = [];
  const hunks: Hunk[] = [];
  let current: Hunk | null = null;

  for (const line of diff.split('\n')) {
    const found = HUNK.exec(line);
    if (found) {
      current = {
        header: line,
        lines: [line],
        start: Number(found[1]),
        count: found[2] === undefined ? 1 : Number(found[2]),
      };
      hunks.push(current);
      continue;
    }

    if (current === null) {
      // A trailing blank from the split is not part of the header.
      if (line !== '' || preamble.length > 0) preamble.push(line);
      continue;
    }

    // `\ No newline at end of file` belongs to the hunk above it, and a patch
    // that drops it applies a newline the original did not have.
    if (line === '' ) continue;
    current.lines.push(line);
  }

  return { preamble: preamble.filter((l) => l !== ''), hunks };
}

/**
 * The hunk a line of the working copy falls in, or the one after it.
 *
 * "The one after" matters: the cursor is usually in unchanged code, and the
 * hunk a person means is the next change below them rather than none at all.
 */
export function hunkAt(hunks: Hunk[], line: number): number {
  for (let i = 0; i < hunks.length; i++) {
    const hunk = hunks[i] as Hunk;
    if (line < hunk.start) return i;
    if (line < hunk.start + Math.max(1, hunk.count)) return i;
  }
  return hunks.length - 1;
}

/**
 * One hunk, as a patch git will apply on its own.
 *
 * The file header has to come with it - a patch without `--- a/…` and
 * `+++ b/…` is a patch git cannot place - and the trailing newline has to be
 * there, because `git apply` rejects a patch that ends mid-line.
 */
export function patchFor(diff: Diff, index: number): string | null {
  const hunk = diff.hunks[index];
  if (!hunk) return null;
  return `${[...diff.preamble, ...hunk.lines].join('\n')}\n`;
}

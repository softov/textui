import type { ResourceDecoration } from '@textui/core';
import type { Change, Status } from './git.js';
import { codeOf, toneOf } from './changes.js';

/**
 * Git, in the explorer.
 *
 * The tree knows nothing about git. It asks what mark a URI carries and draws
 * it, so this is the whole of "show me what changed without leaving the file
 * list" - a status turned into marks, published under one name.
 *
 * Folders carry the marks of what is inside them, because a change three
 * levels down is invisible otherwise and the reason to look at a file tree is
 * to find things you have not opened yet.
 */

/** The name git publishes its marks under. */
export const GIT_SOURCE = 'git';

/**
 * A dot rather than a letter on a folder.
 *
 * A folder is not modified; something in it is. Borrowing the file's two-letter
 * code would say the folder itself was staged, which is a sentence git would
 * never write.
 */
const ROLLUP = '·';

/**
 * The same URI the filesystem provider hands out.
 *
 * Built here rather than imported: this package is loaded *by* textide and
 * cannot depend on it. `file://` and an absolute path is the whole scheme, and
 * a test pins it.
 */
function uriOf(root: string, relative: string): string {
  const base = root.endsWith('/') ? root.slice(0, -1) : root;
  return `file://${base}/${relative}`;
}

/** Which of two tones matters more when a folder holds both. */
function louder(
  a: ResourceDecoration['tone'],
  b: ResourceDecoration['tone'],
): ResourceDecoration['tone'] {
  const rank = (tone: ResourceDecoration['tone']): number =>
    (tone === 'warning' ? 2 : tone === 'success' ? 1 : 0);
  return rank(a) >= rank(b) ? a : b;
}

/** Every folder between the root and a file, nearest last. */
function ancestors(relative: string): string[] {
  const parts = relative.split('/').filter((p) => p !== '');
  parts.pop();
  const out: string[] = [];
  let at = '';
  for (const part of parts) {
    at = at === '' ? part : `${at}/${part}`;
    out.push(at);
  }
  return out;
}

export function decorationsOf(
  status: Status | null,
  root: string,
): Record<string, ResourceDecoration> {
  if (!status) return {};

  const out: Record<string, ResourceDecoration> = {};
  const folders = new Map<string, ResourceDecoration['tone']>();

  for (const change of status.changes as Change[]) {
    out[uriOf(root, change.path)] = { badge: codeOf(change), tone: toneOf(change) };
    for (const folder of ancestors(change.path)) {
      folders.set(folder, louder(folders.get(folder), toneOf(change)));
    }
  }

  for (const [folder, tone] of folders) {
    const uri = uriOf(root, folder);
    // A folder that is itself a change - a rename can report one - keeps what
    // git said about it rather than being overwritten by its own contents.
    if (out[uri]) continue;
    out[uri] = { badge: ROLLUP, ...(tone !== undefined ? { tone } : {}) };
  }

  return out;
}

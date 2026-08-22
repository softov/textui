import type { Resource, ResourceKind, ResourceProvider, ResourceViewerDefinition } from '@textui/core';
import { readDiff, readStatus, type Git, type Status } from './git.js';

/**
 * git as resources.
 *
 * A diff is a thing you open, so it is a resource and it opens through the
 * registry like anything else. That is what makes it a *tab* rather than a
 * panel with its own rules: the editor already knows how to show whatever the
 * registry says opens a URI, and it never learns that git exists.
 *
 * `git:diff/<path>` is everything not committed for one path. The path is the
 * one git reports - relative to the working tree root - so it round-trips
 * through a URI without a second idea of where the repository is.
 */

export const SCHEME = 'git';
export const DIFF_PREFIX = `${SCHEME}:diff/`;

export function diffUri(path: string): string {
  return `${DIFF_PREFIX}${encodeURIComponent(path)}`;
}

/** The path a `git:diff/...` URI is about, or null for anything else. */
export function diffPath(uri: string): string | null {
  return uri.startsWith(DIFF_PREFIX) ? decodeURIComponent(uri.slice(DIFF_PREFIX.length)) : null;
}

export const GIT_KINDS: ResourceKind[] = [
  { id: 'git', title: 'Git' },
  {
    id: 'git.diff',
    title: 'Diff',
    extends: 'git',
    priority: 100,
    detect: (uri) => uri.startsWith(DIFF_PREFIX),
  },
];

export const GIT_VIEWERS: ResourceViewerDefinition[] = [
  {
    id: 'git.diff',
    title: 'Diff',
    kinds: ['git.diff'],
    component: 'GitDiff',
    priority: 100,
  },
];

/**
 * Read-only, and it says so.
 *
 * A diff is a view of a difference, not a place to put one - the file is
 * where an edit goes, and it is one tab away. Declaring no `write` capability
 * is what stops the registry offering an editor for it in the first place,
 * rather than offering one that fails on save.
 */
export function createGitProvider(git: Git, status: () => Status): ResourceProvider {
  return {
    scheme: SCHEME,

    stat(uri) {
      const path = diffPath(uri);
      if (path === null) return Promise.resolve(null);
      return Promise.resolve<Resource>({
        uri,
        kind: 'git.diff',
        metadata: { name: path, readonly: true },
        capabilities: ['read'],
      });
    },

    async read(uri) {
      const path = diffPath(uri);
      if (path === null) throw new Error(`not a diff: ${uri}`);
      const change = status().changes.find((c) => c.path === path);
      return readDiff(git, path, change?.untracked === true);
    },
  };
}

/** Read the status, and never throw at a caller that only wants to draw. */
export async function safeStatus(git: Git): Promise<Status | null> {
  try {
    return await readStatus(git);
  } catch {
    // Not a repository, git not installed, a lock held by another process -
    // all of them mean the same thing to a status bar: say nothing.
    return null;
  }
}

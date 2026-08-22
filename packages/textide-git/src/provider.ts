import type { Resource, ResourceKind, ResourceProvider, ResourceViewerDefinition } from '@textui/core';
import { readDiff, readStatus, type Git, type Status } from './git.js';
import { LOG_FORMAT } from './history.js';

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
export const LOG_PREFIX = `${SCHEME}:log/`;
export const BLAME_PREFIX = `${SCHEME}:blame/`;

export function diffUri(path: string): string {
  return `${DIFF_PREFIX}${encodeURIComponent(path)}`;
}

/**
 * The whole repository, or one path's history.
 *
 * An empty path is the repository, which is why the prefix keeps its slash:
 * `git:log/` is a URI and `git:log` would be a scheme with nothing after it.
 */
export function logUri(path = ''): string {
  return `${LOG_PREFIX}${encodeURIComponent(path)}`;
}

export function blameUri(path: string): string {
  return `${BLAME_PREFIX}${encodeURIComponent(path)}`;
}

function after(prefix: string, uri: string): string | null {
  return uri.startsWith(prefix) ? decodeURIComponent(uri.slice(prefix.length)) : null;
}

/** The path a `git:diff/...` URI is about, or null for anything else. */
export function diffPath(uri: string): string | null {
  return after(DIFF_PREFIX, uri);
}

export function logPath(uri: string): string | null {
  return after(LOG_PREFIX, uri);
}

export function blamePath(uri: string): string | null {
  return after(BLAME_PREFIX, uri);
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
  {
    id: 'git.log',
    title: 'History',
    extends: 'git',
    priority: 100,
    detect: (uri) => uri.startsWith(LOG_PREFIX),
  },
  {
    id: 'git.blame',
    title: 'Blame',
    extends: 'git',
    priority: 100,
    detect: (uri) => uri.startsWith(BLAME_PREFIX),
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
  {
    id: 'git.log',
    title: 'History',
    kinds: ['git.log'],
    component: 'GitLog',
    priority: 100,
  },
  {
    id: 'git.blame',
    title: 'Blame',
    kinds: ['git.blame'],
    component: 'GitBlame',
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
      const diff = diffPath(uri);
      if (diff !== null) {
        return Promise.resolve<Resource>({
          uri,
          kind: 'git.diff',
          metadata: { name: diff, readonly: true },
          capabilities: ['read'],
        });
      }

      const log = logPath(uri);
      if (log !== null) {
        return Promise.resolve<Resource>({
          uri,
          // The repository's own history has no path, so it is named for what
          // it is rather than for an empty string.
          kind: 'git.log',
          metadata: { name: log === '' ? 'History' : `History of ${log}`, readonly: true },
          capabilities: ['read'],
        });
      }

      const blame = blamePath(uri);
      if (blame !== null) {
        return Promise.resolve<Resource>({
          uri,
          kind: 'git.blame',
          metadata: { name: `Blame of ${blame}`, readonly: true },
          capabilities: ['read'],
        });
      }

      return Promise.resolve(null);
    },

    async read(uri) {
      const diff = diffPath(uri);
      if (diff !== null) {
        const change = status().changes.find((c) => c.path === diff);
        return readDiff(git, diff, change?.untracked === true);
      }

      const log = logPath(uri);
      // Read raw rather than parsed: a provider returns *content*, and the
      // viewer for the kind is what knows how to read it. Parsing here would
      // mean a buffer nothing else could hold.
      if (log !== null) {
        return git.lenient('log', LOG_FORMAT, '-n200', ...(log === '' ? [] : ['--', log]));
      }

      const blame = blamePath(uri);
      if (blame !== null) return git.lenient('blame', '--porcelain', '--', blame);

      throw new Error(`not a git resource: ${uri}`);
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

import type { BindingPath, Resource, TextUIApp } from '@textui/core';
import { findMatches, type FindQuery } from '@textui/core';

/**
 * Searching the workspace.
 *
 * Through the resource registry rather than the filesystem: the explorer
 * already browses whatever providers are registered, and a search that only
 * knows about files would be a search that stops working the moment somebody
 * mounts something else. `list` and `read` are the whole of what it needs.
 *
 * No index and no watching. A workspace of a few thousand files is a few
 * hundred milliseconds, which is fast enough to be honest about - and an index
 * that can be stale is a search that can lie.
 */

export const SEARCH_ROOT = '$/ui/search';
export const SEARCH_QUERY = `${SEARCH_ROOT}/query` as BindingPath;
export const SEARCH_RESULTS = `${SEARCH_ROOT}/results` as BindingPath;
export const SEARCH_STATE = `${SEARCH_ROOT}/state` as BindingPath;
export const SEARCH_SELECTED = `${SEARCH_ROOT}/selected` as BindingPath;

export interface Hit {
  uri: string;
  /** What to show as the name of the thing that matched. */
  name: string;
  line: number;
  column: number;
  /** The whole line, for context. Trimmed, because indentation is not the hit. */
  text: string;
}

export interface SearchState {
  query: string;
  /** How many files were read, so "no results" can say how hard it looked. */
  scanned: number;
  done: boolean;
  /** Set when the walk stopped early. */
  stopped?: string;
}

export interface SearchOptions {
  /** Stop after this many hits. A search that returns 40,000 rows is a hang. */
  limit?: number;
  /** Stop after reading this many resources. */
  maxFiles?: number;
  /** Skip a resource before reading it. Binary files, `node_modules`. */
  skip?(resource: Resource): boolean;
}

const DEFAULTS: Required<Pick<SearchOptions, 'limit' | 'maxFiles'>> = {
  limit: 500,
  maxFiles: 4000,
};

/**
 * Names not worth reading, ever.
 *
 * A list rather than a config: these are the directories that make a search of
 * a JavaScript project take a minute instead of a second, and nobody has ever
 * wanted a hit inside one. A workspace that disagrees can pass its own `skip`.
 */
const NEVER = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.dev', '.textui']);

/**
 * Very rough, and only to avoid pasting a binary into a results list.
 *
 * A NUL byte is what every other tool uses for this, and it is right often
 * enough: text files do not contain one and binaries nearly always do in the
 * first few bytes.
 */
function looksBinary(text: string): boolean {
  return text.indexOf('\u0000') !== -1;
}

/**
 * Walk the workspace and collect the lines that match.
 *
 * Depth first and in order, so results arrive in the order a person would read
 * the tree - and so stopping early stops somewhere explicable rather than in
 * the middle of a hash bucket.
 */
export async function searchWorkspace(
  app: TextUIApp,
  root: string,
  query: FindQuery,
  options: SearchOptions = {},
): Promise<{ hits: Hit[]; state: SearchState }> {
  const limit = options.limit ?? DEFAULTS.limit;
  const maxFiles = options.maxFiles ?? DEFAULTS.maxFiles;
  const state: SearchState = { query: query.text, scanned: 0, done: false };
  const hits: Hit[] = [];

  if (query.text === '') return { hits, state: { ...state, done: true } };

  const visit = async (uri: string): Promise<void> => {
    if (hits.length >= limit || state.scanned >= maxFiles) return;

    let children: Resource[];
    try {
      children = await app.resources.list(uri);
    } catch {
      // A directory that will not list is one directory, not a failed search.
      return;
    }

    for (const child of children) {
      if (hits.length >= limit || state.scanned >= maxFiles) return;
      if (NEVER.has(child.metadata.name)) continue;
      if (options.skip?.(child) === true) continue;

      if (child.capabilities.includes('list')) {
        await visit(child.uri);
        continue;
      }
      if (!child.capabilities.includes('read')) continue;

      state.scanned++;
      let text: string;
      try {
        const raw = await app.resources.read(child.uri);
        text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
      } catch {
        continue;
      }
      if (looksBinary(text)) continue;

      const lines = text.split('\n');
      for (const match of findMatches(text, query)) {
        if (hits.length >= limit) break;
        hits.push({
          uri: child.uri,
          name: child.metadata.name,
          line: match.line,
          column: match.start,
          text: (lines[match.line] ?? '').trim(),
        });
      }
    }
  };

  await visit(root);

  state.done = true;
  if (hits.length >= limit) state.stopped = `first ${limit}`;
  else if (state.scanned >= maxFiles) state.stopped = `first ${maxFiles} files`;
  return { hits, state };
}

/** One line about what was found, for a header or a status bar. */
export function summarise(hits: Hit[], state: SearchState): string {
  if (!state.done) return `searching for "${state.query}"…`;
  if (hits.length === 0) return `no matches for "${state.query}" in ${state.scanned} files`;

  const files = new Set(hits.map((h) => h.uri)).size;
  const where = files === 1 ? '1 file' : `${files} files`;
  const found = hits.length === 1 ? '1 match' : `${hits.length} matches`;
  return `${found} in ${where}${state.stopped ? ` (${state.stopped})` : ''}`;
}

/** Group hits by the resource they are in, keeping the order they were found. */
export function byFile(hits: Hit[]): { uri: string; name: string; hits: Hit[] }[] {
  const out: { uri: string; name: string; hits: Hit[] }[] = [];
  for (const hit of hits) {
    const last = out[out.length - 1];
    if (last && last.uri === hit.uri) last.hits.push(hit);
    else out.push({ uri: hit.uri, name: hit.name, hits: [hit] });
  }
  return out;
}

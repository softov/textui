import type { BindingPath } from '../types/graph.js';

/**
 * Store paths are JSON-Pointer-shaped.
 *
 *   `$/scope/a/b`  absolute; the first segment is the scope
 *   `/a/b`         relative to the surrounding data context
 *   `..`           forbidden - escape to the root with `$/` instead, so a
 *                  node's meaning never depends on where it was pasted
 *   `*`            wildcard segment; legal in subscriptions, never in writes
 *
 * Internally a path is its segment list. The canonical key is the segments
 * joined by `/` with no sigil, which is what every map here is keyed by.
 */

export class PathError extends Error {
  constructor(message: string, readonly path: string) {
    super(`${message}: ${path}`);
    this.name = 'PathError';
  }
}

function unescapeSegment(seg: string): string {
  return seg.includes('~') ? seg.replace(/~1/g, '/').replace(/~0/g, '~') : seg;
}

export function escapeSegment(seg: string): string {
  return seg.replace(/~/g, '~0').replace(/\//g, '~1');
}

export function isAbsolute(path: string): path is `$/${string}` {
  return path.startsWith('$/');
}

export function isRelative(path: string): boolean {
  return path.startsWith('/');
}

/** Split into segments. Does not resolve relatives - use `resolvePath`. */
export function segments(path: string): string[] {
  const body = isAbsolute(path) ? path.slice(2) : path.startsWith('/') ? path.slice(1) : path;
  if (body === '') return [];
  const parts = body.split('/');
  for (const p of parts) {
    if (p === '..') throw new PathError('".." is forbidden in a store path', path);
  }
  return parts.map(unescapeSegment);
}

/**
 * Canonical map key for a path: segments joined, no sigil.
 *
 * The segments are re-escaped on the way out. Everything downstream - the
 * store's own walk, `keysTouch`, `matchKey` - splits a key on `/`, so a
 * segment that legitimately contains one (a URI used as a key, a filename with
 * a slash) has to stay escaped or it silently becomes several segments and the
 * value lands somewhere nobody looks.
 */
export function pathKey(path: string): string {
  return segments(path).map(escapeSegment).join('/');
}

export function joinPath(...parts: (string | number)[]): BindingPath {
  const segs: string[] = [];
  for (const p of parts) {
    const s = String(p);
    for (const seg of s.replace(/^\$\//, '').replace(/^\//, '').split('/')) {
      if (seg !== '') segs.push(seg);
    }
  }
  return `$/${segs.join('/')}` as BindingPath;
}

/**
 * Resolve a possibly-relative path against a data context.
 * A relative path with no context is an error a caller should never reach.
 */
export function resolvePath(path: string, dataContext?: string): BindingPath {
  if (isAbsolute(path)) return path as BindingPath;
  if (!path.startsWith('/')) {
    throw new PathError('a path must start with "$/" or "/"', path);
  }
  if (!dataContext) {
    throw new PathError('relative path used with no data context', path);
  }
  const base = segments(dataContext);
  const rest = segments(path);
  return `$/${[...base, ...rest].join('/')}` as BindingPath;
}

export function scopeOf(path: string): string {
  const segs = segments(path);
  return segs[0] ?? '';
}

export function parentKey(key: string): string | null {
  const i = key.lastIndexOf('/');
  return i === -1 ? (key === '' ? null : '') : key.slice(0, i);
}

export function isDescendantKey(key: string, ancestor: string): boolean {
  if (ancestor === '') return key !== '';
  return key.startsWith(ancestor + '/');
}

/**
 * Whether two concrete keys can affect the same subscribed value.
 *
 * A write to a descendant changes the ancestor object a subscriber reads, and a
 * write to an ancestor may replace the whole subtree below it. This relation is
 * symmetric and avoids building ancestor lists in hot subscription checks.
 */
export function keysTouch(a: string, b: string): boolean {
  return a === b || isDescendantKey(a, b) || isDescendantKey(b, a);
}

export function hasWildcard(path: string): boolean {
  return path.includes('*');
}

/** Match a concrete key against a pattern key that may contain `*`. */
export function matchKey(key: string, pattern: string, subtree = false): boolean {
  if (!pattern.includes('*')) {
    return key === pattern || (subtree && isDescendantKey(key, pattern));
  }
  const p = pattern.split('/');
  const k = key.split('/');
  if (!subtree && p.length !== k.length) return false;
  if (subtree && k.length < p.length) return false;
  for (let i = 0; i < p.length; i++) {
    if (p[i] === '*') continue;
    if (p[i] !== k[i]) return false;
  }
  return true;
}

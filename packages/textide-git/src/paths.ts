import { isAbsolute, join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Between what git says and what textide publishes.
 *
 * Git speaks in paths relative to the working tree, with forward slashes
 * whatever the platform. Textide speaks in the URIs its filesystem provider
 * hands out, which are `pathToFileURL` of an absolute path - so `file:///` and
 * forward slashes there too, with a drive letter after the third slash on
 * Windows. Gluing `file://` onto a path made the same URI on one platform and
 * `file://C:\repo\a.txt` on the other, which matched nothing textide had ever
 * shown.
 *
 * Built here rather than imported: this package is loaded *by* textide and
 * cannot depend on it, and a test pins the scheme.
 */

/** The URI of a path git reported, relative to the working tree. */
export function uriOf(root: string, relativePath: string): string {
  return pathToFileURL(join(root, relativePath)).href;
}

/**
 * A `file:` URI as the path git would call it, or null if it is not a file
 * inside the working tree.
 */
export function pathIn(root: string, uri: unknown): string | null {
  if (typeof uri !== 'string' || !uri.startsWith('file:')) return null;
  let path: string;
  try {
    path = fileURLToPath(uri);
  } catch {
    return null;
  }
  const inside = relative(root, path);
  if (inside === '' || inside.startsWith('..') || isAbsolute(inside)) return null;
  return inside.split(sep).join('/');
}

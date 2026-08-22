// The repo root, found from this file rather than from the working directory.
//
// These scripts run from the workspace root under `pnpm docs:*`, and from
// `scripts/docs/snippets` under that package's own `typecheck` - so anything
// resolved against `process.cwd()` works in one place and not the other.
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** A repo-relative path, made absolute. */
export function at(...parts) {
  return resolve(ROOT, ...parts);
}

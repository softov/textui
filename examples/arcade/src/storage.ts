import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { PersistenceAdapter } from '@textui/core';
import { SCORES } from './data.js';

/**
 * The high score table: one JSON file.
 *
 * One path is persisted and the rest of `$/arcade` is not, which is the whole
 * design of the store here made visible - the scores are the only thing about
 * a game that outlives the process. A restored `paused`, or a restored
 * generation counter, would mean opening the arcade tomorrow into a game that
 * is paused for a reason nobody remembers.
 */
export interface FileStoreOptions {
  path: string;
  debounceMs?: number;
}

interface FileShape {
  version: 1;
  scores?: Record<string, number>;
}

export function fileStore(options: FileStoreOptions): PersistenceAdapter {
  const path = resolve(options.path);

  return {
    id: `arcade:${path}`,
    paths: [SCORES],
    debounceMs: options.debounceMs ?? 200,

    async read(): Promise<Record<string, unknown>> {
      let raw: string;
      try {
        raw = await readFile(path, 'utf8');
      } catch (err) {
        // No file yet is a first run, not an error.
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {};
        throw err;
      }
      const data = JSON.parse(raw) as FileShape;
      return data.scores ? { [SCORES]: data.scores } : {};
    },

    async write(entries: Record<string, unknown>): Promise<void> {
      const shape: FileShape = {
        version: 1,
        scores: entries[SCORES] as Record<string, number>,
      };
      await mkdir(dirname(path), { recursive: true });
      // Beside it, then renamed over: a process killed mid-write leaves the
      // previous table rather than half of a new one.
      const temp = `${path}.tmp`;
      await writeFile(temp, `${JSON.stringify(shape, null, 2)}\n`, 'utf8');
      await rename(temp, path);
    },
  };
}

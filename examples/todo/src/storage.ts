import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { PersistenceAdapter } from '@textui/core';
import { PROJECTS, SETTINGS, TASKS } from './data.js';

/**
 * The database: one JSON file.
 *
 * A persistence adapter rather than saving by hand, which means nothing in
 * this application ever calls "save". The store owns which paths are
 * persisted, when the writes coalesce and when they are read back, so a
 * command that toggles a task is written the same way as one that adds a
 * project - by writing to the store and nothing else.
 *
 * The file is the tree under `$/todo`, minus the parts that are about this
 * run rather than about the data: what is selected, and what was typed into
 * the search box. Persisting those would restore a selection pointing at a
 * task that has since gone.
 */
export interface FileStoreOptions {
  /** Where the file lives. Created, with its directory, on the first write. */
  path: string;
  /** Coalesce writes by this many ms. */
  debounceMs?: number;
}

interface FileShape {
  version: 1;
  tasks?: Record<string, unknown>;
  projects?: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

export function fileStore(options: FileStoreOptions): PersistenceAdapter {
  const path = resolve(options.path);

  return {
    id: `todo:${path}`,
    // A trailing slash means the subtree. Without it only an exact write to
    // `$/todo/tasks` would count, and every write here is to one task inside
    // it.
    paths: [`${TASKS}/`, `${PROJECTS}/`, SETTINGS],
    debounceMs: options.debounceMs ?? 200,

    async read(): Promise<Record<string, unknown>> {
      let raw: string;
      try {
        raw = await readFile(path, 'utf8');
      } catch (err) {
        // No file yet is not an error - it is the first run. Anything else is,
        // and losing it would look like the data silently not being there.
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {};
        throw err;
      }

      const data = JSON.parse(raw) as FileShape;
      const entries: Record<string, unknown> = {};
      // Only what the file actually holds, so a file written by an older
      // version leaves the seeded defaults for whatever it does not mention.
      if (data.tasks) entries[TASKS] = data.tasks;
      if (data.projects) entries[PROJECTS] = data.projects;
      if (data.settings) entries[SETTINGS] = data.settings;
      return entries;
    },

    async write(entries: Record<string, unknown>): Promise<void> {
      const shape: FileShape = {
        version: 1,
        tasks: entries[TASKS] as Record<string, unknown>,
        projects: entries[PROJECTS] as Record<string, unknown>,
        settings: entries[SETTINGS] as Record<string, unknown>,
      };

      await mkdir(dirname(path), { recursive: true });
      // Write beside it and rename over: a process killed halfway through a
      // write leaves the previous file, not half of a new one. The rename is
      // atomic on the same filesystem, which is why the temporary file is
      // next to the target rather than in /tmp.
      const temp = `${path}.tmp`;
      await writeFile(temp, `${JSON.stringify(shape, null, 2)}\n`, 'utf8');
      await rename(temp, path);
    },
  };
}

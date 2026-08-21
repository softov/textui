import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type {
  Resource, ResourceAdapter, ResourceProvider, CommandContext, BindingPath,
} from '@textui/core';
import { confirm, notify, prompt } from '@textui/core';

/**
 * The filesystem, as an adapter.
 *
 * Everything the filesystem means is in one value: what a directory is, where
 * bytes come from, and what can be done to them. The explorer never learns any
 * of it - it browses URIs and asks the registry what a kind allows - which is
 * why the same tree works over a provider that is a network, an archive or a
 * git object store.
 *
 * Creating a directory is a command here rather than a method on
 * `ResourceProvider`, because with one provider a contract change would be
 * speculative. When a second provider wants folders, that is the moment the
 * capability earns a place in the contract.
 */

export function uriToPath(uri: string): string {
  return uri.startsWith('file:') ? fileURLToPath(uri) : uri;
}

export function pathToUri(path: string): string {
  return pathToFileURL(path).href;
}

export function extensionOf(uri: string): string {
  return extname(uriToPath(uri)).toLowerCase();
}

export interface FilesystemOptions {
  /** Refuse every write. */
  readonly?: boolean;
  /** Show dotfiles. Off by default. */
  hidden?: boolean;
  /** Names never listed, whatever `hidden` says. */
  exclude?: string[];
  /** Where the application publishes the selected resource. */
  activePath?: BindingPath;
}

const DEFAULT_EXCLUDE = ['node_modules', '.git', 'dist', '.dev'];

export function createFilesystemProvider(options: FilesystemOptions = {}): ResourceProvider {
  const readonly = options.readonly === true;
  const exclude = new Set(options.exclude ?? DEFAULT_EXCLUDE);

  const visible = (name: string): boolean =>
    !exclude.has(name) && (options.hidden === true || !name.startsWith('.'));

  return {
    scheme: 'file',

    async stat(uri) {
      const path = uriToPath(uri);
      try {
        const info = await stat(path);
        const directory = info.isDirectory();
        return {
          uri,
          // Left for the registry to classify, so one place owns the rules.
          kind: 'unknown',
          metadata: {
            name: basename(path) || path,
            size: info.isFile() ? info.size : undefined,
            modified: info.mtimeMs,
            created: info.birthtimeMs,
            readonly,
            // The provider is the only thing that has already asked the disk.
            // Saying so here is what lets the `directory` kind be detected
            // without every classification costing another stat.
            directory,
          },
          capabilities: directory
            ? (readonly ? ['list'] : ['list', 'delete', 'rename'])
            : (readonly ? ['read'] : ['read', 'write', 'delete', 'rename']),
        };
      } catch {
        return null;
      }
    },

    async list(uri) {
      const path = uriToPath(uri);
      const entries = (await readdir(path, { withFileTypes: true }))
        .filter((entry) => visible(entry.name))
        // Directories first, then alphabetical: the order a person expects.
        .sort((a, b) => {
          if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

      const out: Resource[] = [];
      for (const entry of entries) {
        const full = join(path, entry.name);
        const directory = entry.isDirectory();
        let size: number | undefined;
        try {
          if (entry.isFile()) size = (await stat(full)).size;
        } catch {
          // A file that vanished between readdir and stat is not worth
          // failing the whole listing over.
        }
        out.push({
          uri: pathToUri(full),
          kind: 'unknown',
          metadata: { name: entry.name, size, readonly, directory },
          capabilities: directory
            ? (readonly ? ['list'] : ['list', 'delete', 'rename'])
            : (readonly ? ['read'] : ['read', 'write', 'delete', 'rename']),
        });
      }
      return out;
    },

    read: (uri) => readFile(uriToPath(uri), 'utf8'),

    async write(uri, content) {
      if (readonly) throw new Error('this workspace is open read-only');
      await writeFile(uriToPath(uri), content);
    },

    async delete(uri) {
      if (readonly) throw new Error('this workspace is open read-only');
      await rm(uriToPath(uri), { recursive: true, force: true });
    },

    async rename(from, to) {
      if (readonly) throw new Error('this workspace is open read-only');
      await rename(uriToPath(from), uriToPath(to));
    },
  };
}

/** Where textide publishes what the explorer has selected. */
export const ACTIVE_PATH = '$/active/resource' as BindingPath;

function targetOf(
  args: Record<string, unknown>,
  ctx: CommandContext,
  activePath: BindingPath,
): string | null {
  const explicit = args.uri;
  if (typeof explicit === 'string' && explicit !== '') return explicit;
  const active = ctx.store.get<string>(`${activePath}/uri` as BindingPath);
  return typeof active === 'string' && active !== '' ? active : null;
}

/** The directory a new entry lands in: the selection, or its parent. */
async function containerOf(app: CommandContext['app'], uri: string): Promise<string> {
  const resource = await app.resources.stat(uri);
  return resource?.capabilities.includes('list') === true
    ? uriToPath(uri)
    : dirname(uriToPath(uri));
}

export function filesystemAdapter(options: FilesystemOptions = {}): ResourceAdapter {
  const activePath = options.activePath ?? ACTIVE_PATH;
  const target = (args: Record<string, unknown>, ctx: CommandContext): string | null =>
    targetOf(args, ctx, activePath);

  const writable = options.readonly !== true;

  return {
    id: 'textide.filesystem',
    title: 'Filesystem',
    description: 'Browse and edit files on this machine.',

    providers: [createFilesystemProvider(options)],

    kinds: [
      { id: 'file', title: 'File' },
      {
        id: 'directory',
        title: 'Directory',
        icon: 'folder',
        priority: 100,
        detect: (_uri, meta) => meta.directory === true,
      },
      { id: 'file.text', title: 'Text', extends: 'file', extensions: ['*.txt', '*.log'] },
      { id: 'file.markdown', title: 'Markdown', extends: 'file.text', extensions: ['*.md', '*.mdx'] },
      {
        id: 'file.code',
        title: 'Code',
        extends: 'file.text',
        extensions: [
          '*.ts', '*.tsx', '*.js', '*.jsx', '*.mjs', '*.cjs',
          '*.c', '*.h', '*.go', '*.rs', '*.py', '*.sh', '*.css', '*.html',
        ],
      },
      { id: 'file.data', title: 'Data', extends: 'file', extensions: ['*.yaml', '*.yml', '*.toml', '*.ini'] },
    ],

    // The editor is a resource editor like any other: the registry decides
    // that a text file opens in it, and `mode: 'edit'` is what asks for one.
    editors: writable
      ? [{
          id: 'textide.edit',
          title: 'Editor',
          kinds: ['file.text', 'file.code', 'file.markdown', 'file.data'],
          component: 'CodeEditor',
          saves: true as const,
          priority: 100,
        }]
      : [],

    commands: writable
      ? [
          {
            id: 'fs.newFile',
            title: 'New File',
            category: 'File',
            slots: ['palette'],
            run: async (args: Record<string, unknown>, ctx: CommandContext) => {
              const uri = target(args, ctx);
              if (!uri) return;
              const dir = await containerOf(ctx.app, uri);
              const name = await prompt(ctx.app.layers, { title: 'New File', message: dir });
              if (!name) return;
              await writeFile(join(dir, name), '', { flag: 'wx' });
              notify(ctx.app, { tone: 'success', message: `Created ${name}` });
            },
          },
          {
            id: 'fs.newFolder',
            title: 'New Folder',
            category: 'File',
            slots: ['palette'],
            run: async (args: Record<string, unknown>, ctx: CommandContext) => {
              const uri = target(args, ctx);
              if (!uri) return;
              const dir = await containerOf(ctx.app, uri);
              const name = await prompt(ctx.app.layers, { title: 'New Folder', message: dir });
              if (!name) return;
              await mkdir(join(dir, name), { recursive: false });
              notify(ctx.app, { tone: 'success', message: `Created ${name}/` });
            },
          },
          {
            id: 'fs.rename',
            title: 'Rename',
            category: 'File',
            slots: ['palette'],
            run: async (args: Record<string, unknown>, ctx: CommandContext) => {
              const uri = target(args, ctx);
              if (!uri) return;
              const path = uriToPath(uri);
              const name = await prompt(ctx.app.layers, {
                title: 'Rename', message: path, initialValue: basename(path),
              });
              if (!name || name === basename(path)) return;
              await rename(path, join(dirname(path), name));
              notify(ctx.app, { tone: 'success', message: `Renamed to ${name}` });
            },
          },
          {
            id: 'fs.delete',
            title: 'Delete',
            category: 'File',
            slots: ['palette'],
            run: async (args: Record<string, unknown>, ctx: CommandContext) => {
              const uri = target(args, ctx);
              if (!uri) return;
              const path = uriToPath(uri);
              // Deleting is the one thing here that cannot be undone, so it is
              // the one thing that asks.
              const ok = await confirm(ctx.app.layers, {
                title: 'Delete',
                message: `Delete ${basename(path)}? This cannot be undone.`,
                confirmLabel: 'Delete',
                tone: 'danger',
              });
              if (!ok) return;
              await rm(path, { recursive: true, force: true });
              notify(ctx.app, { tone: 'success', message: `Deleted ${basename(path)}` });
            },
          },
        ]
      : [],

    // An action is how a kind offers itself in a menu or a toolbar; the command
    // is the single implementation both it and the palette reach. Spelling the
    // work twice is how a context menu and a keybinding drift apart.
    actions: writable
      ? ([
          { id: 'fs.newFile', title: 'New File', kinds: ['directory'], slots: ['context', 'toolbar'] },
          { id: 'fs.newFolder', title: 'New Folder', kinds: ['directory'], slots: ['context', 'toolbar'] },
          { id: 'fs.rename', title: 'Rename', kinds: ['*'], slots: ['context'] },
          { id: 'fs.delete', title: 'Delete', kinds: ['*'], slots: ['context'] },
        ] as const).map((action) => ({
          ...action,
          kinds: [...action.kinds],
          slots: [...action.slots],
          run: (args: Record<string, unknown>, ctx: CommandContext) =>
            ctx.app.execute(action.id, args),
        }))
      : [],
  };
}

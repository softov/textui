import { readdir, readFile, stat, writeFile, rename, rm } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { isDocumentDirty, revertDocument } from '@textui/documents';
import type { TextUIApp, Resource, ResourceProvider } from '@textui/core';

/**
 * A filesystem resource provider, and the kinds and viewers that go with it.
 *
 * This is the worked example the brief asks for, and the thing it demonstrates
 * is that the explorer never learns about files. It browses URIs; the registry
 * decides what a `.md` is and which component opens it, so adding a viewer for
 * a new extension makes it work everywhere at once.
 */

function uriToPath(uri: string): string {
  return uri.startsWith('file:') ? fileURLToPath(uri) : uri;
}

function pathToUri(path: string): string {
  return pathToFileURL(path).href;
}

export function createFilesystemProvider(options: { readonly?: boolean } = {}): ResourceProvider {
  return {
    scheme: 'file',

    async stat(uri) {
      const path = uriToPath(uri);
      try {
        const info = await stat(path);
        return {
          uri,
          // Left for the registry to classify, so one place owns the rules.
          kind: 'unknown',
          metadata: {
            name: basename(path) || path,
            size: info.isFile() ? info.size : undefined,
            modified: info.mtimeMs,
            created: info.birthtimeMs,
            readonly: options.readonly === true,
          },
          capabilities: info.isDirectory()
            ? ['list']
            : options.readonly
              ? ['read']
              : ['read', 'write', 'delete', 'rename'],
        };
      } catch {
        return null;
      }
    },

    async list(uri) {
      const path = uriToPath(uri);
      const entries = await readdir(path, { withFileTypes: true });

      const visible = entries
        .filter((entry) => !entry.name.startsWith('.'))
        // Directories first, then alphabetical: the order a person expects.
        .sort((a, b) => {
          if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

      const out: Resource[] = [];
      for (const entry of visible) {
        const full = join(path, entry.name);
        let size: number | undefined;
        try {
          if (entry.isFile()) size = (await stat(full)).size;
        } catch {
          // A file that vanished between readdir and stat is not an error
          // worth failing the whole listing over.
        }
        out.push({
          uri: pathToUri(full),
          kind: 'unknown',
          metadata: { name: entry.name, size, readonly: options.readonly === true },
          capabilities: entry.isDirectory() ? ['list'] : ['read'],
        });
      }
      return out;
    },

    async read(uri) {
      return readFile(uriToPath(uri), 'utf8');
    },

    async write(uri, content) {
      if (options.readonly) throw new Error('this provider is read-only');
      await writeFile(uriToPath(uri), content as string, 'utf8');
    },

    async delete(uri) {
      if (options.readonly) throw new Error('this provider is read-only');
      await rm(uriToPath(uri), { recursive: true, force: true });
    },

    async rename(from, to) {
      if (options.readonly) throw new Error('this provider is read-only');
      await rename(uriToPath(from), uriToPath(to));
    },
  };
}

const TEXT_EXTENSIONS = ['*.txt', '*.log', '*.env', '*.gitignore'];
const CODE_EXTENSIONS = ['*.ts', '*.tsx', '*.js', '*.jsx', '*.mjs', '*.cjs', '*.py', '*.go', '*.rs', '*.c', '*.h'];
const DATA_EXTENSIONS = ['*.json', '*.yaml', '*.yml', '*.toml'];

/**
 * Register the kinds, the provider, the viewers and the actions.
 *
 * Kinds form a hierarchy by dotted name, so a viewer registered for
 * `file.text` still opens a `.rs` file when nothing more specific exists.
 */
export function registerFilesystem(
  app: TextUIApp,
  options: { readonly?: boolean } = {},
): void {
  app.resources.registerProvider(createFilesystemProvider(options));

  app.resources.registerKind({ id: 'file', title: 'File', priority: 0 });
  app.resources.registerKind({
    id: 'directory',
    title: 'Directory',
    priority: 10,
    // Extensions cannot answer this; only the provider knows.
    detect: (_uri, meta) => meta.size === undefined && meta.name !== '',
  });
  app.resources.registerKind({ id: 'file.text', title: 'Text', extends: 'file', extensions: TEXT_EXTENSIONS });
  app.resources.registerKind({ id: 'file.markdown', title: 'Markdown', extends: 'file.text', extensions: ['*.md', '*.mdx'] });
  app.resources.registerKind({ id: 'file.code', title: 'Code', extends: 'file.text', extensions: CODE_EXTENSIONS });
  app.resources.registerKind({ id: 'file.data', title: 'Data', extends: 'file.text', extensions: DATA_EXTENSIONS });

  app.resources.registerViewer({
    id: 'markdown', title: 'Markdown', kinds: ['file.markdown'],
    component: 'MarkdownViewer', priority: 100,
  });
  app.resources.registerViewer({
    id: 'code', title: 'Source', kinds: ['file.code', 'file.data'],
    component: 'TextViewer', priority: 80,
  });
  app.resources.registerViewer({
    id: 'text', title: 'Plain text', kinds: ['file.text'],
    component: 'TextViewer', priority: 40,
  });
  app.resources.registerViewer({
    id: 'unknown', title: 'Details', kinds: [],
    component: 'FallbackViewer', fallback: true,
  });

  // An editor exists only when the provider can write, because offering to
  // edit something that cannot be saved is worse than not offering.
  if (!options.readonly) {
    app.resources.registerEditor({
      id: 'text-edit', title: 'Edit', kinds: ['file.text'],
      component: 'CodeViewer', saves: true, priority: 10,
    });
  }

  app.resources.registerAction({
    id: 'file.copyPath',
    title: 'Copy path',
    kinds: ['file', 'directory'],
    slots: ['context', 'palette'],
    run: (args, ctx) => {
      const uri = String(args.uri ?? '');
      ctx.store.set('$/clipboard/last', uriToPath(uri));
    },
  });

  // Undo for everything an adapter's transforms do. It works on the buffer, so
  // it is available even here, where the provider refuses to write.
  app.resources.registerAction({
    id: 'file.revert',
    title: 'Revert changes',
    kinds: ['file'],
    slots: ['context', 'palette'],
    run: (args, ctx) => {
      const uri = String(args.uri ?? '');
      if (isDocumentDirty(ctx.store, uri)) revertDocument(ctx.store, uri);
    },
  });

  app.resources.registerAction({
    id: 'file.reveal',
    title: 'Show details',
    kinds: ['file'],
    slots: ['context'],
    run: async (args, ctx) => {
      const uri = String(args.uri ?? '');
      const resource = await ctx.app.resources.stat(uri);
      ctx.store.set('$/explorer/details', resource);
    },
  });
}

/** The extension a URI ends with, for display. */
export function extensionOf(uri: string): string {
  return extname(uriToPath(uri)).replace(/^\./, '') || 'none';
}

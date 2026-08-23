import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * The extension somebody has not written yet.
 *
 * "Add Extension" asks for a specifier, and until there is something to point
 * it at that is a question with no answer. The loader worked and there was
 * nothing loadable - textide-git is bundled and loads itself, so the one
 * extension in existence was the one you could not learn from.
 *
 * So the scaffold writes a working one. Not a stub with `// your code here`:
 * what it writes runs, contributes something you can see, and is short enough
 * to read in one sitting. The fastest way to understand a plugin system is to
 * delete things from a plugin that works.
 *
 * There is one template and it lives here, in code, rather than in a file
 * copied out of the repo - an extension has to load from a *user's* workspace,
 * and a template that ships as a path is a template that is missing the moment
 * textide is installed rather than cloned.
 */

/** Where a scaffolded extension goes, relative to the workspace root. */
export const EXTENSION_DIR = 'tools';

/**
 * A name a file can have and `.textide.json` can hold.
 *
 * Lowercased, and anything that is not a letter, digit or dash becomes a dash:
 * a specifier goes into a config file, through `import()`, and onto a
 * filesystem, and the intersection of what those three accept is small.
 */
export function slugOf(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug === '' ? 'extension' : slug;
}

/** A source id from a slug: `acme.word-count` is somebody else's to pick. */
function sourceIdOf(slug: string): string {
  return `local.${slug}`;
}

/** A component name from a slug: `word-count` becomes `WordCountPanel`. */
function componentOf(slug: string): string {
  const camel = slug.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  return `${camel}Panel`;
}

/**
 * What the scaffold writes.
 *
 * Plain JavaScript with **no imports at all**, which is not a simplification -
 * it is the thing worth showing. The panel is a `template` renderer: a tree of
 * data whose props are `{ path: '$/somewhere' }`, which the runtime reads out
 * of the store and redraws when it changes. JSX compiles to exactly this data.
 * So an extension needs nothing installed beside it and no build step.
 *
 * That rules out hooks, which are imports and are the reason a *function*
 * component would need one - and it is why the counting lives in `activate`
 * and the panel is four bindings. Formatting happens on the code side so the
 * data side stays bindings.
 *
 * Both halves are here because an extension usually needs both and the
 * difference between them is the thing to learn: the manifest is what can be
 * *read* - a list of extensions, a menu of panels, an exact undo - and
 * `activate` is for what a declaration cannot say, which here is "watch the
 * open file".
 */
export function extensionSource(name: string): string {
  const slug = slugOf(name);
  const component = componentOf(slug);
  const title = slug.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');

  return `/**
 * ${title} - a textide extension.
 *
 * Counts what is in the file you are looking at, in a sidebar panel.
 *
 * There are **no imports**, and that is the thing to notice rather than a
 * simplification. A component can be plain data, a prop can be
 * \`{ path: '$/somewhere' }\` and the runtime reads it out of the store and
 * redraws when it changes. JSX compiles to exactly this data. So an extension
 * needs nothing installed beside it and no build step to be loadable.
 *
 * Delete things from it. That is the fastest way to find out what each part
 * was holding up.
 */

/** Where the editor publishes the file that is open. */
const EDITOR_URI = '$/ui/editor/uri';
/**
 * And where documents keep their contents.
 *
 * Keyed by URI with \`/\` written as \`~1\` and \`~\` as \`~0\`, the JSON Pointer
 * escape - a path segment cannot contain the separator, and a URI is nothing
 * but separators.
 */
const DOCUMENTS = '$/session/documents';

/** What this extension publishes. The panel binds to these four paths. */
const OUT = '$/${slug}';

/**
 * The declarative half: everything that can be said without running.
 *
 * It is *read* as well as applied - this is what puts a row in the Extensions
 * panel and an entry in the sidebar chooser, and what gives unloading
 * something exact to take back out.
 *
 * The panel is a \`template\` renderer: a tree of data, with four props bound
 * to store paths. No function, no hooks, no import.
 */
export const manifest = {
  source: {
    id: '${sourceIdOf(slug)}',
    displayName: '${title}',
    description: 'Counts the lines, words and characters in the open file.',
  },
  contributes: {
    components: [{
      component: '${component}',
      category: 'data',
      description: 'Line, word and character counts for the open file.',
      renderer: {
        kind: 'template',
        template: {
          component: 'box',
          direction: 'column',
          children: [
            { component: 'text', content: { path: OUT + '/name' }, bold: true },
            { component: 'text', content: { path: OUT + '/lines' }, fg: 'muted' },
            { component: 'text', content: { path: OUT + '/words' }, fg: 'muted' },
            { component: 'text', content: { path: OUT + '/chars' }, fg: 'muted' },
          ],
        },
      },
    }],
    views: [{
      surface: 'sidebar',
      key: '${slug}',
      target: { component: '${component}' },
      display: { title: '${title}' },
    }],
    commands: [{
      id: '${slug}.show',
      title: 'Show ${title}',
      category: 'View',
      slots: ['palette'],
      run: (args, ctx) => {
        ctx.app.surfaces.activate('sidebar', '${slug}');
        ctx.store.set('$/ui/sidebar/collapsed', false);
      },
    }],
  },
};

/**
 * The other half: what a declaration cannot express.
 *
 * Here that is "watch the open file", which is a subscription and therefore
 * code. It returns its own undo - whatever this put in place, disposing takes
 * back out - and the loader keeps that beside the manifest's.
 *
 * Strings rather than numbers, because a bound prop is shown as it is: the
 * formatting is this side of the boundary, and the panel stays four bindings.
 */
export function activate(app, context) {
  const escape = (uri) => uri.replace(/~/g, '~0').replace(/\\//g, '~1');

  const recount = () => {
    const uri = app.store.get(EDITOR_URI);
    if (!uri) {
      app.store.set(OUT, { name: 'No file open.', lines: '', words: '', chars: '' });
      return;
    }
    const doc = app.store.get(DOCUMENTS + '/' + escape(uri));
    const text = doc && typeof doc.content === 'string' ? doc.content : '';
    const words = text.split(/\\s+/).filter(Boolean).length;
    // A file that ends in a newline does not have an empty last line, it has
    // a terminated last one - splitting gives one part too many, which is the
    // off-by-one every line counter is born with.
    const body = text.endsWith('\\n') ? text.slice(0, -1) : text;
    const lines = body === '' ? 0 : body.split('\\n').length;
    app.store.set(OUT, {
      name: uri.split('/').pop() || uri,
      lines: lines + (lines === 1 ? ' line' : ' lines'),
      words: words + (words === 1 ? ' word' : ' words'),
      chars: text.length + ' characters',
    });
  };

  recount();
  const stop = [
    app.store.subscribe(EDITOR_URI, recount),
    // The subtree, not one document: which document matters changes with the
    // tab, so a subscription to today's path stops answering tomorrow.
    app.store.subscribe(DOCUMENTS, recount),
  ];

  return { dispose: () => { for (const s of stop) s.dispose(); } };
}
`;
}

export interface ScaffoldResult {
  /** Absolute path written. */
  path: string;
  /** What `.textide.json` should hold, and what `import()` will take. */
  specifier: string;
}

/**
 * Write one, and refuse to overwrite one.
 *
 * A scaffold that clobbers is a scaffold that eats the extension you were
 * halfway through writing, and "New" is one row above "Add" in a menu.
 */
export async function scaffoldExtension(root: string, name: string): Promise<ScaffoldResult> {
  const slug = slugOf(name);
  const specifier = `./${EXTENSION_DIR}/${slug}.js`;
  const path = join(root, EXTENSION_DIR, `${slug}.js`);

  if (existsSync(path)) {
    throw new Error(`${specifier} already exists`);
  }

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, extensionSource(name), 'utf8');
  return { path, specifier };
}

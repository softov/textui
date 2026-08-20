import type { SyntaxSpan } from '../types/syntax.js';
import type { ResourceAdapter } from '../types/adapter.js';
import type { CommandContext } from '../types/command.js';
import type { TextUIApp } from '../types/app.js';
import type { BindingPath } from '../types/graph.js';
import { spanHighlighter } from '../core/syntax.js';
import { getDocument, openDocument, setDocumentContent } from '../core/documents.js';
import { JSON_COMPONENTS } from '../ui/json.js';
import { notify } from '../ui/overlay.js';

/**
 * The JSON adapter.
 *
 * This is the worked example of what an adapter is: one value that says what
 * JSON is, how to colour it, what opens it, and what can be done to it. An
 * application registers it and gets coloured source, a structure view, and
 * format/minify/sort in the palette and the context menu - none of which the
 * explorer, the viewer or the palette knows anything about.
 *
 *     app.registerAdapter(jsonAdapter());
 */

// ---------------------------------------------------------------- scanner

const WHITESPACE = new Set([' ', '\t', '\n', '\r']);
const NUMBER_BODY = /[0-9+\-.eE]/;

/**
 * Score a JSON document into coloured spans.
 *
 * A scanner rather than a parser, because a viewer must colour a file that is
 * being edited and therefore invalid half the time. Anything it cannot explain
 * becomes `invalid`, which is more useful on screen than a thrown error.
 */
export function scanJson(text: string): SyntaxSpan[] {
  const spans: SyntaxSpan[] = [];
  const stack: ('object' | 'array')[] = [];
  let expectKey = false;
  let i = 0;

  const punctuation = (): void => {
    spans.push({ start: i, end: i + 1, scope: 'punctuation' });
    i++;
  };

  while (i < text.length) {
    const c = text[i] as string;

    if (WHITESPACE.has(c)) {
      i++;
      continue;
    }

    if (c === '"') {
      const scope = expectKey ? 'key' : 'string';
      const start = i;
      i++;
      let segment = start;

      while (i < text.length) {
        const ch = text[i];
        if (ch === '\\') {
          // The escape is its own colour; the quoted text around it keeps its.
          if (i > segment) spans.push({ start: segment, end: i, scope });
          const length = text[i + 1] === 'u' ? 6 : 2;
          spans.push({ start: i, end: Math.min(i + length, text.length), scope: 'escape' });
          i += length;
          segment = i;
          continue;
        }
        if (ch === '"') {
          i++;
          break;
        }
        if (ch === '\n') break; // unterminated: stop at the line, like an editor
        i++;
      }
      if (i > segment) spans.push({ start: segment, end: i, scope });
      continue;
    }

    if (c === '{') {
      stack.push('object');
      expectKey = true;
      punctuation();
      continue;
    }
    if (c === '[') {
      stack.push('array');
      expectKey = false;
      punctuation();
      continue;
    }
    if (c === '}' || c === ']') {
      stack.pop();
      expectKey = false;
      punctuation();
      continue;
    }
    if (c === ',') {
      expectKey = stack[stack.length - 1] === 'object';
      punctuation();
      continue;
    }
    if (c === ':') {
      expectKey = false;
      punctuation();
      continue;
    }

    if (c === '-' || (c >= '0' && c <= '9')) {
      const start = i;
      i++;
      while (i < text.length && NUMBER_BODY.test(text[i] as string)) i++;
      spans.push({ start, end: i, scope: 'number' });
      continue;
    }

    if (text.startsWith('true', i) || text.startsWith('false', i)) {
      const end = i + (text[i] === 't' ? 4 : 5);
      spans.push({ start: i, end, scope: 'boolean' });
      i = end;
      continue;
    }
    if (text.startsWith('null', i)) {
      spans.push({ start: i, end: i + 4, scope: 'null' });
      i += 4;
      continue;
    }

    // Anything else does not belong in JSON. Show it rather than hide it.
    const start = i;
    while (
      i < text.length &&
      !WHITESPACE.has(text[i] as string) &&
      !'{}[],:"'.includes(text[i] as string)
    ) {
      i++;
    }
    spans.push({ start, end: Math.max(i, start + 1), scope: 'invalid' });
    if (i === start) i++;
  }

  return spans;
}

export const jsonHighlighter = spanHighlighter({
  id: 'json',
  title: 'JSON',
  kinds: ['file.data.json'],
  extensions: ['*.json', '*.jsonc', '*.webmanifest'],
  priority: 10,
  scan: scanJson,
});

// -------------------------------------------------------------- transforms

export interface JsonFormatOptions {
  indent?: number;
}

/**
 * Pretty-print.
 *
 * Note that this round-trips through `JSON.parse`, so comments and the
 * original ordering of integer-like keys do not survive. That is the honest
 * cost of formatting with the platform parser, and it is stated here rather
 * than discovered.
 */
export function formatJson(text: string, options: JsonFormatOptions = {}): string {
  return JSON.stringify(JSON.parse(text), null, options.indent ?? 2);
}

export function minifyJson(text: string): string {
  return JSON.stringify(JSON.parse(text));
}

/** Sort every object's keys, recursively. Arrays keep their order. */
export function sortJsonKeys(text: string, options: JsonFormatOptions = {}): string {
  const sort = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sort);
    if (value && typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>);
      entries.sort(([a], [b]) => a.localeCompare(b));
      return Object.fromEntries(entries.map(([k, v]) => [k, sort(v)]));
    }
    return value;
  };
  return JSON.stringify(sort(JSON.parse(text)), null, options.indent ?? 2);
}

export interface JsonProblem {
  message: string;
  /** 1-based, when the parser gave a position. */
  line?: number;
  column?: number;
}

/** Parse for errors only. Returns null when the document is valid. */
export function validateJson(text: string): JsonProblem | null {
  try {
    JSON.parse(text);
    return null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const at = /position (\d+)/.exec(message);
    if (!at) return { message };

    const offset = Number(at[1]);
    const before = text.slice(0, offset);
    const line = before.split('\n').length;
    const column = offset - before.lastIndexOf('\n');
    return { message, line, column };
  }
}

// ----------------------------------------------------------------- actions

/** Where an action looks for its target when nothing was passed. */
export const ACTIVE_RESOURCE_PATH = '$/active/resource/uri' as BindingPath;

function targetUri(args: Record<string, unknown>, ctx: CommandContext): string | null {
  const explicit = args.uri;
  if (typeof explicit === 'string' && explicit !== '') return explicit;
  const active = ctx.store.get<string>(ACTIVE_RESOURCE_PATH);
  return typeof active === 'string' && active !== '' ? active : null;
}

/**
 * Run a text transform against a URI's buffer.
 *
 * The buffer, not the file: formatting something a provider will not let you
 * write should still show you the formatted document. Saving is a separate,
 * explicit act.
 */
async function transform(
  app: TextUIApp,
  uri: string,
  label: string,
  fn: (text: string) => string,
): Promise<boolean> {
  const doc = getDocument(app.store, uri) ?? (await openDocument(app, uri));
  const problem = validateJson(doc.content);
  if (problem) {
    notify(app, {
      tone: 'danger',
      title: `Cannot ${label.toLowerCase()}`,
      message: problem.line
        ? `${problem.message} (line ${problem.line})`
        : problem.message,
    });
    return false;
  }

  const next = fn(doc.content);
  if (next === doc.content) {
    notify(app, { tone: 'info', message: `Already ${label.toLowerCase()}ed.` });
    return false;
  }

  setDocumentContent(app.store, uri, next);
  notify(app, { tone: 'success', message: `${label} applied.` });
  return true;
}

export interface JsonAdapterOptions {
  /** Spaces per level for `format` and `sort keys`. */
  indent?: number;
  /** Also claim `.jsonc` and `.webmanifest`. On by default. */
  extensions?: string[];
}

export function jsonAdapter(options: JsonAdapterOptions = {}): ResourceAdapter {
  const indent = options.indent ?? 2;
  const extensions = options.extensions ?? ['*.json', '*.jsonc', '*.webmanifest'];

  const operations: {
    id: string;
    title: string;
    keys?: string;
    run(text: string): string;
  }[] = [
    { id: 'json.format', title: 'Format', run: (t) => formatJson(t, { indent }) },
    { id: 'json.minify', title: 'Minify', run: minifyJson },
    { id: 'json.sortKeys', title: 'Sort keys', run: (t) => sortJsonKeys(t, { indent }) },
  ];

  return {
    id: 'json',
    title: 'JSON',
    description: 'Kind, colours, a structure view and text transforms for JSON.',

    kinds: [
      {
        id: 'file.data.json',
        title: 'JSON',
        extends: 'file.data',
        extensions,
        mimeTypes: ['application/json'],
        priority: 5,
      },
    ],

    highlighters: [{ ...jsonHighlighter, extensions }],

    components: JSON_COMPONENTS,

    viewers: [
      {
        id: 'json.source',
        title: 'Source',
        kinds: ['file.data.json'],
        component: 'JsonViewer',
        priority: 120,
      },
      {
        id: 'json.tree',
        title: 'Structure',
        kinds: ['file.data.json'],
        component: 'JsonTreeViewer',
        priority: 110,
      },
    ],

    actions: [
      ...operations.map((op) => ({
        id: op.id,
        title: op.title,
        kinds: ['file.data.json'],
        slots: ['context', 'palette'],
        run: async (args: Record<string, unknown>, ctx: CommandContext) => {
          const uri = targetUri(args, ctx);
          if (uri) await transform(ctx.app, uri, op.title, op.run);
        },
      })),
      {
        id: 'json.validate',
        title: 'Validate',
        kinds: ['file.data.json'],
        slots: ['context', 'palette'],
        run: async (args: Record<string, unknown>, ctx: CommandContext) => {
          const uri = targetUri(args, ctx);
          if (!uri) return;
          const doc = getDocument(ctx.store, uri) ?? (await openDocument(ctx.app, uri));
          const problem = validateJson(doc.content);
          notify(ctx.app, problem
            ? {
                tone: 'danger',
                title: 'Invalid JSON',
                message: problem.line ? `Line ${problem.line}: ${problem.message}` : problem.message,
              }
            : { tone: 'success', message: 'Valid JSON.' });
        },
      },
    ],

    // The same operations as commands, so the palette and a keybinding reach
    // them without a resource being selected in any particular pane.
    commands: [
      ...operations.map((op) => ({
        id: op.id,
        title: `JSON: ${op.title}`,
        category: 'JSON',
        slots: ['palette'],
        when: `$/active/resource/kind == 'file.data.json'`,
        run: async (args: Record<string, unknown>, ctx: CommandContext) => {
          const uri = targetUri(args, ctx);
          if (uri) await transform(ctx.app, uri, op.title, op.run);
        },
      })),
    ],
  };
}

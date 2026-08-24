import type { ComponentDefinition, BoxProps, Resource } from '@textui/core';
import { h, defineComponent, useMemo, useTheme } from '@textui/core';
import { CodeViewer, Tree, type TreeNode, EmptyState, ErrorState, Spinner } from '@textui/widgets';
import { useDocument } from '../use-document.js';

/**
 * The two ways to look at a JSON file.
 *
 * They exist as a pair on purpose: a kind with two registered viewers is what
 * makes "open with" a real choice rather than a menu with one entry, and it is
 * the smallest honest test of whether the viewer registry does anything.
 */

export interface JsonViewerProps extends BoxProps {
  resource?: Resource;
  uri?: string;
  content?: string;
  lineNumbers?: boolean;
}

/** JSON source, coloured by the registered highlighter. */
export const JsonViewer = defineComponent<JsonViewerProps>('JsonViewer', (props) => {
  const theme = useTheme();
  const { resource, uri, content, lineNumbers = true, ...rest } = props;
  const target = content === undefined ? (uri ?? resource?.uri ?? null) : null;
  const doc = useDocument(target);

  if (content === undefined && doc.status === 'running') {
    return h(Spinner, { label: `Loading${theme.glyphs.ellipsis}`, ...rest });
  }
  if (content === undefined && doc.status === 'error') {
    return h(ErrorState, { error: doc.error, ...rest });
  }

  return h(CodeViewer, {
    content: content ?? doc.content,
    lineNumbers,
    kind: resource?.kind ?? doc.kind,
    uri: uri ?? resource?.uri,
    language: 'json',
    flex: 1,
    ...rest,
  });
});

export type JsonTreeViewerProps = JsonViewerProps;

/**
 * The same document as a structure.
 *
 * Values are shown inline next to their key, because a tree that makes you
 * expand a node to discover it holds the number 3 is a worse way to read a
 * config file than the file.
 */
export const JsonTreeViewer = defineComponent<JsonTreeViewerProps>('JsonTreeViewer', (props) => {
  const theme = useTheme();
  const { resource, uri, content, lineNumbers: _ignored, ...rest } = props;
  const target = content === undefined ? (uri ?? resource?.uri ?? null) : null;
  const doc = useDocument(target);
  const text = content ?? doc.content;

  const parsed = useMemo<{ value: unknown } | { error: string }>(() => {
    if (text === '') return { value: undefined };
    try {
      return { value: JSON.parse(text) as unknown };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }, [text]);

  if (content === undefined && doc.status === 'running') {
    return h(Spinner, { label: `Loading${theme.glyphs.ellipsis}`, ...rest });
  }
  if (content === undefined && doc.status === 'error') {
    return h(ErrorState, { error: doc.error, ...rest });
  }
  if ('error' in parsed) {
    return h(EmptyState, {
      title: 'Not valid JSON',
      message: parsed.error,
      hint: 'The source view still shows the file.',
      ...rest,
    });
  }
  if (parsed.value === undefined) return h(EmptyState, { title: 'Empty', ...rest });

  return h(Tree, {
    nodes: toNodes(parsed.value, '', theme.glyphs.ellipsis),
    flex: 1,
    ...rest,
  });
});

/** One tree node per key, with scalars summarised in the `meta` column. */
function toNodes(value: unknown, prefix: string, ellipsis: string): TreeNode[] {
  const entries: [string, unknown][] = Array.isArray(value)
    ? value.map((v, i) => [String(i), v])
    : value && typeof value === 'object'
      ? Object.entries(value as Record<string, unknown>)
      : [];

  return entries.map(([key, child]) => {
    const id = `${prefix}/${key}`;
    const container = child !== null && typeof child === 'object';
    return {
      id,
      label: key,
      hasChildren: container,
      children: container ? toNodes(child, id, ellipsis) : undefined,
      meta: container ? summarise(child) : preview(child, ellipsis),
      tone: container ? 'accent' : toneOf(child),
    };
  });
}

function summarise(value: unknown): string {
  if (Array.isArray(value)) return `[${value.length}]`;
  return `{${Object.keys(value as object).length}}`;
}

function preview(value: unknown, ellipsis: string): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  const shown = text ?? 'undefined';
  return shown.length > 32 ? shown.slice(0, 31) + ellipsis : shown;
}

function toneOf(value: unknown): TreeNode['tone'] {
  if (value === null) return 'muted';
  switch (typeof value) {
    case 'string': return 'success';
    case 'number': return 'info';
    case 'boolean': return 'warning';
    default: return undefined;
  }
}

export const JSON_COMPONENTS: ComponentDefinition[] = [
  {
    component: 'JsonViewer',
    category: 'resource',
    renderer: { kind: 'function', render: JsonViewer },
    role: 'document',
    opens: { resourceKinds: ['file.data.json'], title: 'Source', priority: 60, mode: 'view' },
    description: 'JSON source, coloured by the registered highlighter.',
  },
  {
    component: 'JsonTreeViewer',
    category: 'resource',
    renderer: { kind: 'function', render: JsonTreeViewer },
    role: 'tree',
    opens: { resourceKinds: ['file.data.json'], title: 'Structure', priority: 55, mode: 'view' },
    description: 'JSON as an expandable structure.',
  },
];

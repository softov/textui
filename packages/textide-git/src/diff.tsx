import {
  ScrollThumb, chorded, defineComponent, h, useFocus, useInput, useMeasure, useState,
  viewportRows,
} from '@textui/core';
import type { BoxProps, ComponentDefinition, RenderOutput, StyleColor } from '@textui/core';
import { useDocument } from '@textui/documents';

/**
 * A diff.
 *
 * Not a highlighted `CodeViewer`: the syntax scopes are `keyword`, `string`,
 * `comment` and so on, and there is no honest one for "this line was added".
 * Borrowing `string` because it happens to be green in most themes is how a
 * theme that makes strings orange ends up with orange additions.
 *
 * So a diff is its own component, and the meaning is in the first character
 * before it is in the colour - `+`, `-`, `@` are already the glyph the rule
 * about not depending on colour asks for, which is the other reason not to
 * strip them off and paint the rest.
 */

export interface GitDiffProps extends BoxProps {
  /** The document holding the diff text. */
  uri?: string | null;
  /** Diff text directly, for a preview with no document behind it. */
  value?: string;
  autoFocus?: boolean;
  scrollbar?: boolean;
}

type Row = 'add' | 'remove' | 'hunk' | 'meta' | 'context';

/** What kind of line this is. The first character says, which is the point. */
export function classify(line: string): Row {
  if (line.startsWith('@@')) return 'hunk';
  if (line.startsWith('+++') || line.startsWith('---')) return 'meta';
  if (line.startsWith('diff ') || line.startsWith('index ')
    || line.startsWith('new file') || line.startsWith('deleted file')
    || line.startsWith('similarity ') || line.startsWith('rename ')) return 'meta';
  if (line.startsWith('+')) return 'add';
  if (line.startsWith('-')) return 'remove';
  return 'context';
}

/** Move the view, and never past either end. */
export function scrollDiff(current: number, delta: number, max: number): number {
  return Math.max(0, Math.min(max, current + delta));
}

const TONE: Record<Row, StyleColor | undefined> = {
  add: 'success',
  remove: 'danger',
  hunk: 'info',
  meta: 'muted',
  context: undefined,
};

export const GitDiff = defineComponent<GitDiffProps>('GitDiff', (props) => {
  const { uri = null, value, autoFocus, scrollbar = true, ...rest } = props;
  const doc = useDocument(uri);
  const measured = useMeasure();
  const focus = useFocus({ autoFocus });
  const [top, setTop] = useState(0);

  const text = uri ? doc.content : (value ?? '');
  const lines = text.split('\n');
  // A diff of nothing is a real answer and deserves a sentence, not a blank
  // pane that looks like a viewer that failed to load.
  const empty = text.trim() === '';

  const rows = viewportRows({ flex: 1, ...props }, measured, lines.length);
  const maxTop = Math.max(0, lines.length - rows);
  const first = Math.max(0, Math.min(top, maxTop));

  useInput((event) => {
    if (chorded(event)) return false;
    const to = (delta: number): boolean => {
      setTop(scrollDiff(first, delta, maxTop));
      return true;
    };
    switch (event.name) {
      case 'up': return to(-1);
      case 'down': return to(1);
      case 'pageup': return to(-rows);
      case 'pagedown': return to(rows);
      case 'home': return to(-lines.length);
      case 'end': return to(lines.length);
      default: return false;
    }
  }, { focusId: focus.id });

  const window = lines.slice(first, first + rows);

  return h('box', {
    id: focus.id,
    role: 'document',
    direction: 'row',
    flex: 1,
    ...rest,
  },
    h('box', { direction: 'column', flex: 1 },
      empty
        ? h('text', { content: 'No changes.', fg: 'muted' })
        : null,
      ...window.map((line, i) => {
        const kind = classify(line);
        return h('text', {
          key: first + i,
          content: line.length > 0 ? line : ' ',
          ...(TONE[kind] ? { fg: TONE[kind] } : {}),
          ...(kind === 'hunk' ? { bold: true } : {}),
        });
      })),
    scrollbar && lines.length > rows
      ? h(ScrollThumb, { total: lines.length, rows, offset: first, focused: focus.focused })
      : null,
  );
});

export const DIFF_COMPONENTS: ComponentDefinition[] = [
  {
    component: 'GitDiff',
    category: 'resource',
    renderer: { kind: 'function', render: GitDiff as (props: Record<string, unknown>) => RenderOutput },
    role: 'document',
    description: 'A unified diff, coloured by what each line does.',
  },
];

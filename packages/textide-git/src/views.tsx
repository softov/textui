import type { BoxProps, ComponentDefinition, RenderOutput } from '@textui/core';
import {
  chorded,
  defineComponent,
  h,
  sliceColumns,
  useFocus,
  useInput,
  useMeasure,
  useState,
} from '@textui/core';
import { ScrollThumb, viewportRows } from '@textui/widgets';
import { useDocument } from '@textui/documents';
import { parseBlame, parseLog, authorWidth } from './history.js';

/**
 * The log, and the blame.
 *
 * Both read their text out of a document buffer, like every other viewer: the
 * provider fetched it, the registry chose this component for the kind, and
 * neither of them knows the other exists. What is left here is the half a
 * viewer owns - where the window is, and the keys that move it.
 */

interface ScrollerProps extends BoxProps {
  uri?: string | null;
  value?: string;
  autoFocus?: boolean;
  scrollbar?: boolean;
}

/** The window, the keys, and the scrollbar - the part both of these share. */
function useScroller(
  rows: number,
  count: number,
  autoFocus: boolean | undefined,
): { first: number; focus: ReturnType<typeof useFocus> } {
  const focus = useFocus({ autoFocus });
  const [top, setTop] = useState(0);
  const maxTop = Math.max(0, count - rows);
  const first = Math.max(0, Math.min(top, maxTop));

  useInput((event) => {
    if (chorded(event)) return false;
    const to = (delta: number): boolean => {
      setTop(Math.max(0, Math.min(maxTop, first + delta)));
      return true;
    };
    switch (event.name) {
      case 'up': return to(-1);
      case 'down': return to(1);
      case 'pageup': return to(-rows);
      case 'pagedown': return to(rows);
      case 'home': return to(-count);
      case 'end': return to(count);
      default: return false;
    }
  }, { focusId: focus.id });

  return { first, focus };
}

/**
 * What happened, most recent first.
 *
 * Four columns, and the subject gets whatever is left: a hash you can type, a
 * date you can compare, an author you can recognise, and the sentence somebody
 * wrote about why. Widths are fixed for the first three because they are
 * fixed - a short hash is seven characters and an ISO date is ten - and a
 * column that resizes as you scroll is a column you cannot read down.
 */
export const GitLog = defineComponent<ScrollerProps>('GitLog', (props) => {
  const { uri = null, value, autoFocus, scrollbar = true, ...rest } = props;
  const doc = useDocument(uri);
  const measured = useMeasure();

  const commits = parseLog(uri ? doc.content : (value ?? ''));
  const rows = viewportRows({ flex: 1, ...props }, measured, commits.length);
  const { first, focus } = useScroller(rows, commits.length, autoFocus);

  const width = measured.width > 0 ? measured.width : 80;
  const bar = scrollbar && commits.length > rows ? 1 : 0;
  const authors = Math.min(14, Math.max(6, Math.floor((width - bar) * 0.15)));
  const subject = Math.max(8, width - bar - 7 - 10 - authors - 3);

  if (commits.length === 0) {
    return h('box', { direction: 'column', flex: 1, ...rest },
      h('text', { content: 'No history here yet.', fg: 'muted' }));
  }

  return h('box', { id: focus.id, role: 'document', direction: 'row', flex: 1, ...rest },
    h('box', { direction: 'column', flex: 1 },
      ...commits.slice(first, first + rows).map((commit, i) => h('box', {
        key: first + i,
        direction: 'row',
        height: 1,
      },
        h('text', { content: commit.short.padEnd(7), width: 7, fg: 'accent' }),
        h('text', { content: ' ' }),
        h('text', { content: commit.date.padEnd(10), width: 10, fg: 'muted' }),
        h('text', { content: ' ' }),
        h('text', {
          content: sliceColumns(commit.author, 0, authors).padEnd(authors),
          width: authors,
          fg: 'info',
        }),
        h('text', { content: ' ' }),
        h('text', { content: sliceColumns(commit.subject, 0, subject) })))),
    scrollbar && commits.length > rows
      ? h(ScrollThumb, { total: commits.length, rows, offset: first, focused: focus.focused })
      : null);
});

/**
 * Who last touched each line.
 *
 * The commit is only printed when it *changes*, which is the whole readability
 * of a blame: a file written in three sittings should look like three blocks
 * and not like six hundred repetitions of the same hash.
 */
export const GitBlame = defineComponent<ScrollerProps>('GitBlame', (props) => {
  const { uri = null, value, autoFocus, scrollbar = true, ...rest } = props;
  const doc = useDocument(uri);
  const measured = useMeasure();

  const lines = parseBlame(uri ? doc.content : (value ?? ''));
  const rows = viewportRows({ flex: 1, ...props }, measured, lines.length);
  const { first, focus } = useScroller(rows, lines.length, autoFocus);

  const width = measured.width > 0 ? measured.width : 80;
  const bar = scrollbar && lines.length > rows ? 1 : 0;
  const authors = authorWidth(lines);
  const numbers = String(lines.length).length;
  const text = Math.max(8, width - bar - 7 - 10 - authors - numbers - 5);

  if (lines.length === 0) {
    return h('box', { direction: 'column', flex: 1, ...rest },
      h('text', { content: 'Nothing to blame - the file is not committed.', fg: 'muted' }));
  }

  return h('box', { id: focus.id, role: 'document', direction: 'row', flex: 1, ...rest },
    h('box', { direction: 'column', flex: 1 },
      ...lines.slice(first, first + rows).map((line, i) => {
        const at = first + i;
        const repeat = at > 0 && (lines[at - 1] as { hash: string }).hash === line.hash;
        return h('box', { key: at, direction: 'row', height: 1 },
          h('text', {
            content: repeat ? ' '.repeat(7) : line.short.padEnd(7),
            width: 7,
            fg: 'accent',
          }),
          h('text', { content: ' ' }),
          h('text', {
            content: repeat ? ' '.repeat(10) : line.date.padEnd(10),
            width: 10,
            fg: 'muted',
          }),
          h('text', { content: ' ' }),
          h('text', {
            content: repeat
              ? ' '.repeat(authors)
              : sliceColumns(line.author, 0, authors).padEnd(authors),
            width: authors,
            fg: 'info',
          }),
          h('text', { content: ' ' }),
          h('text', {
            content: String(at + 1).padStart(numbers),
            width: numbers,
            fg: 'subtle',
          }),
          h('text', { content: ' ' }),
          h('text', { content: sliceColumns(line.text, 0, text) }));
      })),
    scrollbar && lines.length > rows
      ? h(ScrollThumb, { total: lines.length, rows, offset: first, focused: focus.focused })
      : null);
});

export const HISTORY_COMPONENTS: ComponentDefinition[] = [
  {
    component: 'GitLog',
    category: 'resource',
    renderer: { kind: 'function', render: GitLog as (props: Record<string, unknown>) => RenderOutput },
    role: 'document',
    description: 'What happened, most recent first.',
  },
  {
    component: 'GitBlame',
    category: 'resource',
    renderer: { kind: 'function', render: GitBlame as (props: Record<string, unknown>) => RenderOutput },
    role: 'document',
    description: 'Who last touched each line.',
  },
];

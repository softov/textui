import {
  ScrollThumb, chorded, defineComponent, h, sliceColumns, useFocus, useInput, useMeasure,
  useRuntime, useState, useStoreValue, viewportRows,
} from '@textui/core';
import type {
  BindingPath, BoxProps, ComponentDefinition, RenderOutput, StyleColor,
} from '@textui/core';
import { useDocument } from '@textui/documents';
import { parseHunks } from './hunks.js';
import { diffPath } from './provider.js';

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

/**
 * How a diff is laid out.
 *
 * `unified` is the diff git prints - one column, `+` and `-` interleaved,
 * which reads well in a narrow pane and is the only honest layout when a
 * change is mostly additions. `split` puts before and after side by side,
 * which is what you want when lines *changed* rather than arrived: the two
 * versions of a line end up on the same row.
 */
export type DiffMode = 'unified' | 'split';

/** Which layout a diff opens in, when nothing says otherwise. */
export const DIFF_MODE = '$/ui/diff/mode' as BindingPath;

export interface GitDiffProps extends BoxProps {
  /** The document holding the diff text. */
  uri?: string | null;
  /** Diff text directly, for a preview with no document behind it. */
  value?: string;
  /** Overrides the stored mode, for a caller that wants one in particular. */
  mode?: DiffMode;
  autoFocus?: boolean;
  scrollbar?: boolean;
}

export interface DiffCell {
  /** The line as git printed it, marker and all. */
  text: string;
  kind: Row;
}

/**
 * One row of a side-by-side diff.
 *
 * `full` is a row that belongs to neither side - a hunk header, a file header -
 * and spans both. Otherwise a side is a line or nothing, and nothing is the
 * gap opposite an added or removed line.
 */
export interface DiffPair {
  left: DiffCell | null;
  right: DiffCell | null;
  full?: DiffCell;
}

/**
 * Turn the diff git prints into two columns.
 *
 * A run of removals followed by a run of additions is one edit, so they pair
 * off in order: the first line that went beside the first that arrived. When
 * the runs are different lengths the shorter side runs out and the rest of the
 * longer one sits opposite nothing, which is exactly what happened to the
 * file. Context appears on both sides, because it is on both sides.
 */
export function trimTrailing(lines: string[]): string[] {
  return lines.length > 1 && lines[lines.length - 1] === '' ? lines.slice(0, -1) : lines;
}

export function pairsOf(input: string[]): DiffPair[] {
  const lines = trimTrailing(input);
  const out: DiffPair[] = [];
  let removed: string[] = [];
  let added: string[] = [];

  const flush = (): void => {
    const n = Math.max(removed.length, added.length);
    for (let i = 0; i < n; i++) {
      out.push({
        left: i < removed.length ? { text: removed[i] as string, kind: 'remove' } : null,
        right: i < added.length ? { text: added[i] as string, kind: 'add' } : null,
      });
    }
    removed = [];
    added = [];
  };

  for (const line of lines) {
    const kind = classify(line);
    if (kind === 'remove') { removed.push(line); continue; }
    if (kind === 'add') { added.push(line); continue; }

    flush();
    if (kind === 'context') {
      out.push({ left: { text: line, kind }, right: { text: line, kind } });
    } else {
      out.push({ left: null, right: null, full: { text: line, kind } });
    }
  }
  flush();

  return out;
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

/**
 * Which hunk a row of the *diff* is in - not a row of the file.
 *
 * Counting `@@` lines at or above the row is the whole rule, and it is the
 * same rule in both layouts once the rows are the right list.
 */
export function hunkOfLine(lines: string[], row: number): number {
  let index = -1;
  for (let i = 0; i <= row && i < lines.length; i++) {
    if (classify(lines[i] as string) === 'hunk') index++;
  }
  return Math.max(0, index);
}

export function hunkOfPair(pairs: DiffPair[], row: number): number {
  let index = -1;
  for (let i = 0; i <= row && i < pairs.length; i++) {
    if ((pairs[i] as DiffPair).full?.kind === 'hunk') index++;
  }
  return Math.max(0, index);
}

const TONE: Record<Row, StyleColor | undefined> = {
  add: 'success',
  remove: 'danger',
  hunk: 'info',
  meta: 'muted',
  context: undefined,
};

export const GitDiff = defineComponent<GitDiffProps>('GitDiff', (props) => {
  const { uri = null, value, mode, autoFocus, scrollbar = true, ...rest } = props;
  const runtime = useRuntime();
  const app = runtime.app();
  // The path this diff is of, for the commands that act on it. The viewer is
  // opened on a `git:diff/<path>` resource, so the URI already says.
  const path = uri !== null ? diffPath(uri) : null;
  const doc = useDocument(uri);
  const measured = useMeasure();
  const focus = useFocus({ autoFocus });
  const [top, setTop] = useState(0);
  // The stored mode, so switching layout switches every diff on screen rather
  // than the one that happens to have been told.
  const stored = useStoreValue<DiffMode>(DIFF_MODE, 'unified');
  const layout: DiffMode = mode ?? stored ?? 'unified';

  const text = uri ? doc.content : (value ?? '');
  // Git's output ends with a newline, and splitting on it leaves an empty
  // string behind - a blank row at the foot of every diff, and one more row of
  // scrolling than there is diff.
  const lines = trimTrailing(text.split('\n'));
  // A diff of nothing is a real answer and deserves a sentence, not a blank
  // pane that looks like a viewer that failed to load.
  const empty = text.trim() === '';

  const pairs = layout === 'split' ? pairsOf(lines) : [];
  const height = layout === 'split' ? pairs.length : lines.length;

  const rows = viewportRows({ flex: 1, ...props }, measured, height);
  const maxTop = Math.max(0, height - rows);
  const first = Math.max(0, Math.min(top, maxTop));

  useInput((event) => {
    if (chorded(event)) return false;

    /*
     * `s` stages what you are looking at, `u` takes it back.
     *
     * Plain letters, because a diff is a viewer and has no text to type into -
     * and the hunk is the one the top of the view is sitting on, which is the
     * one a person means when they scrolled to it.
     */
    if (event.name === 's' || event.name === 'u') {
      if (path === null) return false;
      const { hunks } = parseHunks(text);
      if (hunks.length === 0) return false;
      const index = layout === 'split'
        ? hunkOfPair(pairs, first)
        : hunkOfLine(lines, first);
      void app?.execute('git.stageHunk', {
        path,
        hunk: index,
        ...(event.name === 'u' ? { reverse: true } : {}),
      });
      return true;
    }

    const to = (delta: number): boolean => {
      setTop(scrollDiff(first, delta, maxTop));
      return true;
    };
    switch (event.name) {
      case 'up': return to(-1);
      case 'down': return to(1);
      case 'pageup': return to(-rows);
      case 'pagedown': return to(rows);
      case 'home': return to(-height);
      case 'end': return to(height);
      default: return false;
    }
  }, { focusId: focus.id });

  /*
   * Two columns, each half of what is left after the gutter between them.
   *
   * Sliced rather than truncated: a line that does not fit has to stop at the
   * column edge and not push its neighbour sideways, and a wide grapheme on
   * the boundary has to be dropped whole. `sliceColumns` counts cells, which
   * is the only unit a terminal column is measured in.
   */
  const width = measured.width > 0 ? measured.width : 80;
  const bar = scrollbar && height > rows ? 1 : 0;
  const half = Math.max(4, Math.floor((width - bar - 1) / 2));

  const cell = (side: DiffCell | null, key: string): RenderOutput => h('text', {
    key,
    content: side ? (sliceColumns(side.text, 0, half) || ' ') : ' ',
    width: half,
    ...(side && TONE[side.kind] ? { fg: TONE[side.kind] } : {}),
    // The gap opposite an added or removed line is the shape of the change,
    // so it is drawn rather than left as the screen behind it.
    ...(side === null ? { bg: 'surfaceAlt' } : {}),
  });

  const body = layout === 'split'
    ? pairs.slice(first, first + rows).map((pair, i) => (pair.full
      // A hunk header belongs to neither side, so it spans both.
      ? h('text', {
          key: first + i,
          content: pair.full.text.length > 0 ? pair.full.text : ' ',
          ...(TONE[pair.full.kind] ? { fg: TONE[pair.full.kind] } : {}),
          ...(pair.full.kind === 'hunk' ? { bold: true } : {}),
        })
      : h('box', { key: first + i, direction: 'row', height: 1 },
          cell(pair.left, 'l'),
          h('text', { content: ' ', width: 1, fg: 'borderSubtle' }),
          cell(pair.right, 'r'))))
    : lines.slice(first, first + rows).map((line, i) => {
      const kind = classify(line);
      return h('text', {
        key: first + i,
        content: line.length > 0 ? line : ' ',
        ...(TONE[kind] ? { fg: TONE[kind] } : {}),
        ...(kind === 'hunk' ? { bold: true } : {}),
      });
    });

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
      ...body),
    scrollbar && height > rows
      ? h(ScrollThumb, { total: height, rows, offset: first, focused: focus.focused })
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

import type {
  BindingPath,
  BoxProps,
  ComponentDefinition,
  RenderOutput,
  StyleColor,
} from '@textui/core';
import {
  chorded,
  defineComponent,
  h,
  sliceColumns,
  stringWidth,
  useFocus,
  useInput,
  useMeasure,
  useRuntime,
  useStoreValue,
} from '@textui/core';
import {
  HORIZONTAL_STEP,
  ScrollThumb,
  usePanelState,
  usePanelStatus,
  viewportRows,
} from '@textui/widgets';
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
  /*
   * Where this diff is looking belongs to the panel, the way it does for every
   * other viewer.
   *
   * `top`, `left` and `line` are the shared vocabulary a renderer measuring in
   * lines reads and writes, so switching layout or leaving the tab and coming
   * back lands where you left. It was local state, which meant a diff forgot
   * where it was every time it was unmounted - and switching unified to split
   * unmounts it.
   */
  const [view, setView] = usePanelState({ top: 0, left: 0, line: 0 });
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

  /*
   * The width a line has, and the widest one there is.
   *
   * Both layouts need this and neither had it. A unified row was handed to
   * `text` with no width and no slice, so a diff of a long line drew past the
   * pane and pushed everything beside it - the sidebar is a box with an
   * explicit width and `shrink: 1`, so what it pushed was that.
   */
  const width = measured.width > 0 ? measured.width : 80;
  const bar = scrollbar && height > rows ? 1 : 0;
  // Two columns, each half of what is left after the gutter between them.
  const half = Math.max(4, Math.floor((width - bar - 1) / 2));
  const textWidth = Math.max(1, layout === 'split' ? half : width - bar);
  const longest = lines.reduce((max, line) => Math.max(max, stringWidth(line)), 0);

  const maxTop = Math.max(0, height - rows);
  const maxLeft = Math.max(0, longest - textWidth);

  /*
   * The caret leads and the viewport follows, which is what "navigate like the
   * editor" means. Without a caret the arrows moved the window and there was
   * nothing on the screen saying which line you were on - so `s` had to guess
   * that you meant the one at the top.
   */
  const caret = Math.max(0, Math.min(view.line, Math.max(0, height - 1)));
  const first = Math.min(
    Math.max(0, Math.min(view.top, maxTop)),
    Math.max(0, Math.min(caret, maxTop)),
  );
  const offset = Math.max(first, Math.min(caret - rows + 1, maxTop));
  const leftColumn = Math.max(0, Math.min(view.left, maxLeft));

  /*
   * What this pane says about itself: which hunk the caret is in.
   *
   * The thing only a diff knows, and the thing `s` and `u` act on - so a
   * person about to stage something can see what they are about to stage
   * without counting `@@` lines up the screen.
   */
  const hunkCount = lines.filter((line) => classify(line) === 'hunk').length;
  usePanelStatus(hunkCount === 0 ? null : `Hunk ${
    (layout === 'split' ? hunkOfPair(pairs, caret) : hunkOfLine(lines, caret)) + 1
  } of ${hunkCount}`);

  const moveTo = (next: number): void => {
    const line = Math.max(0, Math.min(next, Math.max(0, height - 1)));
    if (line < offset) setView({ line, top: line });
    else if (line >= offset + rows) setView({ line, top: line - rows + 1 });
    else setView({ line });
  };

  useInput((event) => {
    if (chorded(event)) return false;

    /*
     * `s` stages what you are looking at, `u` takes it back.
     *
     * Plain letters, because a diff is a viewer and has no text to type into -
     * and the hunk is the one the *caret* is in, which is the one a person
     * means when they arrowed down to it. It used to be whichever hunk the top
     * row happened to be inside, because there was no caret to ask.
     */
    if (event.name === 's' || event.name === 'u') {
      if (path === null) return false;
      const { hunks } = parseHunks(text);
      if (hunks.length === 0) return false;
      const index = layout === 'split'
        ? hunkOfPair(pairs, caret)
        : hunkOfLine(lines, caret);
      void app?.execute('git.stageHunk', {
        path,
        hunk: index,
        ...(event.name === 'u' ? { reverse: true } : {}),
      });
      return true;
    }

    const pan = (delta: number): boolean => {
      setView({ left: scrollDiff(leftColumn, delta, maxLeft) });
      return true;
    };
    switch (event.name) {
      case 'up': moveTo(caret - 1); return true;
      case 'down': moveTo(caret + 1); return true;
      case 'pageup': moveTo(caret - rows); return true;
      case 'pagedown': moveTo(caret + rows); return true;
      case 'home': moveTo(0); return true;
      case 'end': moveTo(height - 1); return true;
      // Sideways, by the same step every other viewer pans by.
      case 'left': return pan(-HORIZONTAL_STEP);
      case 'right': return pan(HORIZONTAL_STEP);
      default: return false;
    }
  }, { focusId: focus.id });

  /*
   * Sliced rather than truncated: a line that does not fit has to stop at the
   * column edge and not push its neighbour sideways, and a wide grapheme on
   * the boundary has to be dropped whole. `sliceColumns` counts cells, which
   * is the only unit a terminal column is measured in - and it is what makes
   * `left` and `right` show the rest of a line rather than nothing.
   */
  const window = (line: string): string =>
    sliceColumns(line, leftColumn, textWidth) || ' ';

  const cell = (side: DiffCell | null, key: string): RenderOutput => h('text', {
    key,
    content: side ? window(side.text) : ' ',
    width: half,
    ...(side && TONE[side.kind] ? { fg: TONE[side.kind] } : {}),
    // The gap opposite an added or removed line is the shape of the change,
    // so it is drawn rather than left as the screen behind it.
    ...(side === null ? { bg: 'surfaceAlt' } : {}),
  });

  // The row the caret is on, drawn so that "which line" is a thing you can
  // see rather than infer - which is also what `s` and `u` now act on.
  const onCaret = (index: number): Record<string, unknown> =>
    (index === caret && focus.focused ? { bg: 'surfaceAlt' } : {});

  const body = layout === 'split'
    ? pairs.slice(offset, offset + rows).map((pair, i) => (pair.full
      // A hunk header belongs to neither side, so it spans both.
      ? h('text', {
          key: offset + i,
          content: window(pair.full.text),
          width: textWidth,
          ...(TONE[pair.full.kind] ? { fg: TONE[pair.full.kind] } : {}),
          ...(pair.full.kind === 'hunk' ? { bold: true } : {}),
          ...onCaret(offset + i),
        })
      : h('box', {
          key: offset + i, direction: 'row', height: 1, ...onCaret(offset + i),
        },
          cell(pair.left, 'l'),
          h('text', { content: ' ', width: 1, fg: 'borderSubtle' }),
          cell(pair.right, 'r'))))
    : lines.slice(offset, offset + rows).map((line, i) => {
      const kind = classify(line);
      return h('text', {
        key: offset + i,
        content: window(line),
        // Given, not inferred. Without it a row is as wide as its content and
        // a long line takes the pane with it.
        width: textWidth,
        ...(TONE[kind] ? { fg: TONE[kind] } : {}),
        ...(kind === 'hunk' ? { bold: true } : {}),
        ...onCaret(offset + i),
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
      ? h(ScrollThumb, { total: height, rows, offset, focused: focus.focused })
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

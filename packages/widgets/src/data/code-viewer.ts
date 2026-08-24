import type { BoxProps, RenderOutput, ResolvedTheme, SyntaxToken } from '@textui/core';
import {
  chorded,
  defineComponent,
  expandTabs,
  h,
  nameOf,
  sliceColumns,
  stringWidth,
  useEffect,
  useFocus,
  useHighlight,
  useInput,
  useMeasure,
  useMemo,
  useTheme,
} from '@textui/core';
import type { LineMark } from '../decorations.js';
import { MARK_GLYPH, MARK_TONE, useLineMarks } from '../decorations.js';
import { usePanelState, usePanelStatus } from '../panel/index.js';
import { viewportRows } from '../viewport.js';
import { ScrollThumb } from './scroll-thumb.js';

export interface CodeViewerProps extends BoxProps {
  content: string;
  /** Show line numbers in a gutter. */
  lineNumbers?: boolean;
  startLine?: number;
  /**
   * Fix the number of rows. Left off, the viewer renders exactly as many rows
   * as it was laid out into - which is what stops a long file from resizing
   * the pane it is shown in.
   */
  visibleRows?: number;
  /** Rows to mark, 1-based. */
  highlight?: number[];
  /** Pre-tokenised content, when the caller has already highlighted it. */
  tokens?: SyntaxToken[][];
  /** Ask the registry for a highlighter by id... */
  language?: string;
  /** ...or by resource kind... */
  kind?: string;
  /** ...or by filename. */
  uri?: string;
  /** Caret line, 1-based. Controlled when passed. */
  line?: number;
  onLineChange?(line: number): void;
  /** Called whenever the caret or the viewport moves. */
  onPosition?(position: CodeViewerPosition): void;
  /** Draw a scrollbar when the content is taller than the view. */
  scrollbar?: boolean;
  /** Mark the caret line. Off for a plain excerpt. */
  showCaret?: boolean;
  tabWidth?: number;
  /**
   * Take the keyboard on mount.
   *
   * Wanted by a viewer that is the only thing in a dialog: a modal traps focus
   * but does not hand it to anything, so a scrollable body nobody focused is a
   * body nobody can scroll.
   */
  autoFocus?: boolean;
}

export interface CodeViewerPosition {
  /** Caret line, 1-based. */
  line: number;
  /** Leftmost visible column, 0-based. */
  column: number;
  /** First visible line, 1-based. */
  top: number;
  rows: number;
  lines: number;
  /** Longest line, in cells. */
  width: number;
}

/**
 * How far one press of `left` or `right` pans a viewer that cannot fit its
 * widest line. Exported because every viewer that scrolls sideways has to
 * agree - a diff that panned by one column beside a code view that panned by
 * four would be two different keys wearing the same arrow.
 */
export const HORIZONTAL_STEP = 4;

/**
 * A file viewer.
 *
 * Two things make this different from a column of `text` nodes. It renders
 * only the rows it was given room for, so opening a ten-thousand-line file
 * costs the same as opening a ten-line one and neither of them moves the panes
 * around it. And it colours by asking the registry for a highlighter, so a new
 * file type arrives coloured without this component learning what it is.
 */
export const CodeViewer = defineComponent<CodeViewerProps>('CodeViewer', (props) => {
  const {
    content, lineNumbers = true, startLine = 1, visibleRows, highlight = [],
    tokens, language, kind, uri, line, onLineChange, onPosition,
    scrollbar = true, showCaret = true, tabWidth = 4, disabled, autoFocus, ...rest
  } = props;

  const theme = useTheme();
  const focus = useFocus({ disabled, ...(autoFocus ? { autoFocus } : {}) });
  const measured = useMeasure();

  const text = useMemo(() => expandTabs(content, tabWidth), [content, tabWidth]);
  const lines = useMemo(() => text.split('\n'), [text]);
  const auto = useHighlight(tokens ? '' : text, { language, kind, uri });
  const lineTokens = tokens ?? auto;

  /*
   * Where this viewer is looking belongs to the panel, not to this component.
   *
   * Switching tabs and coming back, or swapping this viewer for an editor on
   * the same file, both unmount it - and both are the moments a reader most
   * expects to land where they left. `line`, `column`, `top` and `left` are
   * the shared vocabulary for a renderer that measures in source lines, so an
   * editor picks up the caret this viewer left behind. Outside a panel the
   * hook is ordinary component state, which is what a viewer in a dialog gets.
   */
  const [view, setView] = usePanelState({ top: 0, left: 0, line: 0 });
  const top = view.top;
  const setTop = (next: number): void => setView({ top: next });
  const left = view.left;
  const setLeft = (next: number): void => setView({ left: next });
  // The record counts from zero, like an index; this component's `line` prop
  // counts from one, like a gutter. The conversion lives here, once.
  const internalLine = view.line + 1;
  const setInternalLine = (next: number): void => setView({ line: next - 1 });

  const rows = viewportRows(props, measured, lines.length, { requested: visibleRows });

  /*
   * The same marks the editor draws, for the same reason.
   *
   * "This line changed" is true of the file, not of whether you happen to be
   * editing it - and it lived only in the editor, so turning the setting on
   * while reading did nothing at all and said nothing about why.
   *
   * The column costs a cell only when somebody has actually marked something,
   * so a viewer nobody has decorated is the width it always was.
   */
  const marks = useLineMarks(uri ?? null);
  const markWidth = Object.keys(marks).length > 0 ? 1 : 0;

  const gutter = lineNumbers ? String(startLine + lines.length - 1).length : 0;
  const bars = scrollbar && lines.length > rows ? 1 : 0;
  const textWidth = Math.max(
    1,
    (measured.width > 0 ? measured.width : 80) - (lineNumbers ? gutter + 1 : 0) - markWidth - bars,
  );

  const longest = useMemo(
    () => lines.reduce((max, l) => Math.max(max, stringWidth(l)), 0),
    [lines],
  );

  const maxTop = Math.max(0, lines.length - rows);
  const maxLeft = Math.max(0, longest - textWidth);
  const caret = clampLine(line ?? internalLine, lines.length);

  // The caret leads and the viewport follows, so arrowing past the last row
  // scrolls rather than parking the caret out of sight.
  const firstVisible = Math.min(
    Math.max(0, Math.min(top, maxTop)),
    Math.max(0, Math.min(caret - 1, maxTop)),
  );
  const offset = Math.max(firstVisible, Math.min(caret - rows, maxTop));
  const leftColumn = Math.max(0, Math.min(left, maxLeft));

  const moveTo = (next: number): void => {
    const clamped = clampLine(next, lines.length);
    if (line === undefined) setInternalLine(clamped);
    onLineChange?.(clamped);
    if (clamped - 1 < offset) setTop(clamped - 1);
    else if (clamped > offset + rows) setTop(clamped - rows);
  };

  const scrollBy = (delta: number): void => {
    const next = Math.max(0, Math.min(maxTop, offset + delta));
    setTop(next);
    // Keep the caret inside the view, the way a pager does.
    const clamped = clampLine(Math.min(Math.max(caret, next + 1), next + rows), lines.length);
    if (line === undefined) setInternalLine(clamped);
    else onLineChange?.(clamped);
  };

  useInput(
    (event) => {
      if (disabled || chorded(event)) return false;
      switch (event.name) {
        case 'up': moveTo(caret - 1); return true;
        case 'down': moveTo(caret + 1); return true;
        case 'pageup': moveTo(caret - rows); return true;
        case 'pagedown': moveTo(caret + rows); return true;
        case 'home': moveTo(1); return true;
        case 'end': moveTo(lines.length); return true;
        case 'left': setLeft(Math.max(0, leftColumn - HORIZONTAL_STEP)); return true;
        case 'right': setLeft(Math.min(maxLeft, leftColumn + HORIZONTAL_STEP)); return true;
        default: return false;
      }
    },
    { focusId: focus.id },
  );

  useEffect(() => {
    onPosition?.({
      line: caret,
      column: leftColumn,
      top: offset + 1,
      rows,
      lines: lines.length,
      width: longest,
    });
  }, [caret, leftColumn, offset, rows, lines.length, longest]);

  /*
   * What this pane says about itself: which file it is showing.
   *
   * A viewer is not an editor and should not pretend to be one - `Ln 12,
   * Col 4` is what the *editor* says, because a caret is a thing you put
   * somewhere and a reader has not put one anywhere. The name is what a
   * reader wants confirmed, particularly in a split where two panes are
   * showing two files and only one of them is focused.
   */
  usePanelStatus(uri !== null && uri !== undefined ? nameOf(uri) : null);

  const body: RenderOutput[] = [];
  for (let i = 0; i < rows; i++) {
    const index = offset + i;
    if (index >= lines.length) break;

    const number = startLine + index;
    const marked = highlight.includes(number);
    const onCaret = showCaret && focus.focused && number === caret + startLine - 1;

    // No `gap` on this row: the gap would land between every token, not only
    // between the gutter and the code, and space out the source by a cell per
    // token. The gutter carries its own trailing space instead.
    body.push(
      h('box', {
        key: number,
        direction: 'row',
        height: 1,
        bg: marked ? 'active' : onCaret ? 'hover' : undefined,
      },
        lineNumbers
          ? h('text', {
              content: `${String(number).padStart(gutter)} `,
              fg: onCaret || marked ? 'text' : 'subtle',
              width: gutter + 1,
            })
          : null,
        // Between the number and the code, which is where the editor puts it
        // too - so swapping a viewer for an editor on the same file does not
        // move the text sideways.
        markWidth > 0
          ? h('text', {
              content: MARK_GLYPH[marks[index] as LineMark] ?? ' ',
              fg: MARK_TONE[marks[index] as LineMark] ?? 'border',
              width: 1,
            })
          : null,
        ...spansFor(
          lineTokens[index] ?? [{ text: lines[index] ?? '', scope: 'plain' }],
          leftColumn,
          textWidth,
          theme,
        ),
      ),
    );
  }

  return h('box', {
    id: focus.id,
    role: 'document',
    direction: 'row',
    onMouse: (event: { action: string; wheel?: number }) => {
      if (event.action !== 'wheel') return false;
      scrollBy((event.wheel ?? 0) * 3);
      return true;
    },
    ...rest,
  },
    h('box', { direction: 'column', flex: 1 }, ...body),
    bars
      ? h(ScrollThumb, { total: lines.length, rows, offset, focused: focus.focused })
      : null,
  );
});

function clampLine(line: number, total: number): number {
  return Math.max(1, Math.min(total === 0 ? 1 : total, Math.round(line)));
}

/**
 * One `text` node per token, sliced to the visible columns.
 *
 * Slicing here rather than truncating in the layout is what keeps the viewer
 * from claiming the width of its longest line - which is the horizontal half
 * of the same bug that makes a pane resize when a file is opened.
 */
function spansFor(
  tokens: SyntaxToken[],
  left: number,
  width: number,
  theme: ResolvedTheme,
): RenderOutput[] {
  const out: RenderOutput[] = [];
  let column = 0;
  let drawn = 0;

  for (let i = 0; i < tokens.length && drawn < width; i++) {
    const token = tokens[i] as SyntaxToken;
    const tokenWidth = stringWidth(token.text);
    const end = column + tokenWidth;

    if (end > left) {
      const from = Math.max(0, left - column);
      const slice = sliceColumns(token.text, from, width - drawn);
      if (slice !== '') {
        out.push(h('text', {
          key: i,
          content: slice,
          fg: token.scope === 'plain' ? undefined : theme.syntax[token.scope],
        }));
        drawn += stringWidth(slice);
      }
    }
    column = end;
  }

  // The row must still fill its width, or the caret background stops short of
  // the right edge and the highlight looks ragged.
  if (drawn < width) out.push(h('box', { flex: 1 }));
  return out;
}

import type { BoxProps } from '@textui/core';
import type {
  ComponentDefinition, LineMark, RenderOutput, ResolvedTheme, StyleColor, SyntaxToken,
} from '@textui/core';
import {
  h, chorded, defineComponent, ScrollThumb, sliceColumns, stringWidth, useClipboard,
  useEffect, useFocus, useHighlight, useInput, useLineMarks, useMeasure, useMemo,
  usePanelState, usePanelStatus, useState, useTheme,
  viewportRows,
} from '@textui/core';
import { useDocument } from '../use-document.js';
import { EMPTY_HISTORY, record, redo, undo, type History, type Snapshot } from '../history.js';

/**
 * A text editor.
 *
 * The viewer already knew how to show a file that is larger than its pane; the
 * editor is what happens when the caret gains a column. That is the whole of
 * the difference, and it is why this is a component rather than a mode on
 * `CodeViewer`: a caret with a column has to own every key, and a viewer that
 * owns every key can no longer be dropped into a preview.
 *
 * The buffer is the document, not local state. Every edit goes through
 * `set`, so the dirty marker, revert, and save-through-provider all keep
 * working without this file knowing they exist.
 */

export interface CodeEditorProps extends BoxProps {
  /** The document to edit. Its buffer is the source of truth. */
  uri?: string | null;
  /**
   * Starting text, for an editor with no document behind it.
   *
   * The buffer is then this component's own: `onChange` reports every edit,
   * but nothing has to be fed back for the next keystroke to be computed
   * against what is actually on screen.
   */
  value?: string;
  onChange?(value: string): void;
  lineNumbers?: boolean;
  /** Spaces one indent step is worth. Also what a soft tab inserts. */
  tabWidth?: number;
  readonly?: boolean;
  /** Ask the syntax registry for a highlighter. */
  language?: string;
  kind?: string;
  onCursor?(cursor: { line: number; column: number }): void;
  /** Reports how much is selected, for a status bar. Zero means none. */
  onSelection?(selection: { chars: number; lines: number }): void;
  /** Draw a scrollbar when the file is taller than the view. On by default. */
  scrollbar?: boolean;
  /** Claim focus on mount, if nothing in this scope already has it. */
  autoFocus?: boolean;
}

interface Cursor { line: number; column: number }

/** An ordered pair of cursors. `start` never comes after `end`. */
interface TextRange { start: Cursor; end: Cursor }

/**
 * What kind of edit this was, for folding a run of them into one step back.
 *
 * Typing a word is one thing that happened. Deleting is a different thing, so
 * it closes the run - and so does a newline, because "undo" that swallows the
 * paragraph you just started is undo you stop trusting.
 */
type EditKind = 'type' | 'delete' | undefined;

/** Clamp a cursor into a buffer, so no movement can land outside the text. */
function clamp(lines: string[], cursor: Cursor): Cursor {
  const line = Math.max(0, Math.min(cursor.line, lines.length - 1));
  const text = lines[line] ?? '';
  return { line, column: Math.max(0, Math.min(cursor.column, text.length)) };
}

/** Split a buffer at a cursor, which is what every edit is expressed as. */
function splitAt(lines: string[], at: Cursor): { before: string; after: string } {
  const text = lines[at.line] ?? '';
  return { before: text.slice(0, at.column), after: text.slice(at.column) };
}

// ------------------------------------------------------------- selection

/**
 * Selection is an anchor and the caret, in that order, and everything else is
 * derived.
 *
 * Keeping the anchor rather than a normalised range is what makes shifting
 * back past where you started shrink the selection instead of flipping it:
 * the end that moves is always the caret, and which end that is on screen is
 * a question for the renderer and nobody else.
 */
function ahead(a: Cursor, b: Cursor): boolean {
  return a.line < b.line || (a.line === b.line && a.column < b.column);
}

function span(anchor: Cursor, caret: Cursor): TextRange {
  return ahead(anchor, caret) ? { start: anchor, end: caret } : { start: caret, end: anchor };
}

function isEmpty(range: TextRange): boolean {
  return range.start.line === range.end.line && range.start.column === range.end.column;
}

function textIn(lines: string[], range: TextRange): string {
  if (range.start.line === range.end.line) {
    return (lines[range.start.line] ?? '').slice(range.start.column, range.end.column);
  }
  return [
    (lines[range.start.line] ?? '').slice(range.start.column),
    ...lines.slice(range.start.line + 1, range.end.line),
    (lines[range.end.line] ?? '').slice(0, range.end.column),
  ].join('\n');
}

/**
 * Replace a range with text - which is cut, paste, and typing over a
 * selection, all three.
 *
 * Returns where the caret belongs afterwards, because every caller needs it
 * and computing it from the content again is how the two disagree.
 */
function replace(lines: string[], range: TextRange, inserted: string): { content: string; cursor: Cursor } {
  const head = (lines[range.start.line] ?? '').slice(0, range.start.column);
  const tail = (lines[range.end.line] ?? '').slice(range.end.column);
  const parts = inserted.split('\n');
  const last = parts[parts.length - 1] ?? '';
  const body = parts.length === 1
    ? [head + last + tail]
    : [head + (parts[0] ?? ''), ...parts.slice(1, -1), last + tail];
  return {
    content: [...lines.slice(0, range.start.line), ...body, ...lines.slice(range.end.line + 1)].join('\n'),
    cursor: parts.length === 1
      ? { line: range.start.line, column: head.length + last.length }
      : { line: range.start.line + parts.length - 1, column: last.length },
  };
}

/**
 * Indent or dedent whole lines.
 *
 * Whole lines, because an indent that started at the caret's column would put
 * the space inside a word half the time. A blank line gains nothing on the way
 * in - trailing whitespace nobody typed is the kind of change that shows up in
 * a diff and has to be explained.
 */
function reindent(lines: string[], from: number, to: number, unit: string, out: boolean): string[] {
  const next = [...lines];
  for (let i = from; i <= to && i < next.length; i++) {
    const line = next[i] ?? '';
    if (!out) {
      if (line.length > 0) next[i] = unit + line;
      continue;
    }
    if (line.startsWith(unit)) next[i] = line.slice(unit.length);
    else if (line.startsWith('\t')) next[i] = line.slice(1);
    else next[i] = line.replace(/^ +/, (run) => run.slice(Math.min(run.length, unit.length)));
  }
  return next;
}

// ---------------------------------------------------------------- pieces

/** One coloured run inside a row. The unit both syntax and selection paint. */
interface Piece { text: string; fg?: StyleColor; bg?: StyleColor }

/** What a marked line looks like. ASCII, so every terminal draws one cell. */
const MARK_GLYPH: Record<LineMark, string> = {
  added: '+',
  changed: '~',
  // The line is gone, so the mark sits on the one below the gap it left.
  removed: '_',
};

const MARK_TONE: Record<LineMark, StyleColor> = {
  added: 'success',
  changed: 'warning',
  removed: 'danger',
};

/**
 * A row as coloured runs.
 *
 * Falls back to one plain run when the highlighter's tokens do not add back up
 * to the line, because every column below is an offset into this text: a
 * highlighter that drops a character would move the caret rather than lose a
 * colour.
 */
function piecesOf(
  line: string,
  tokens: SyntaxToken[] | undefined,
  syntax: ResolvedTheme['syntax'],
): Piece[] {
  if (!tokens || tokens.length === 0) return line.length > 0 ? [{ text: line }] : [];
  if (tokens.map((t) => t.text).join('') !== line) return line.length > 0 ? [{ text: line }] : [];
  return tokens.map((t) => (t.scope === 'plain' ? { text: t.text } : { text: t.text, fg: syntax[t.scope] }));
}

function widthOf(pieces: Piece[]): number {
  return pieces.reduce((n, p) => n + p.text.length, 0);
}

/** Pad a row out to a column, so a highlight can reach past the last glyph. */
function padTo(pieces: Piece[], column: number): Piece[] {
  const short = column - widthOf(pieces);
  return short > 0 ? [...pieces, { text: ' '.repeat(short) }] : pieces;
}

/** Split every run that straddles a column, so a boundary lands between runs. */
function cut(pieces: Piece[], column: number): Piece[] {
  const out: Piece[] = [];
  let x = 0;
  for (const piece of pieces) {
    const end = x + piece.text.length;
    if (column > x && column < end) {
      out.push({ ...piece, text: piece.text.slice(0, column - x) });
      out.push({ ...piece, text: piece.text.slice(column - x) });
    } else out.push(piece);
    x = end;
  }
  return out;
}

/** Restyle the cells in `[from, to)`. Cut at both ends first. */
function paint(pieces: Piece[], from: number, to: number, style: Partial<Piece>): Piece[] {
  let x = 0;
  return cut(cut(padTo(pieces, to), from), to).map((piece) => {
    const start = x;
    x += piece.text.length;
    return start >= from && start < to ? { ...piece, ...style } : piece;
  });
}

/**
 * The visible cells of one row, as `text` nodes.
 *
 * Slicing here rather than letting the layout truncate is the whole fix: a row
 * handed content wider than its pane is a row whose children all get shrunk,
 * including the gutter. Widths are cells, not string indices - `sliceColumns`
 * is what keeps a wide grapheme from sliding the rest of the line one cell
 * against the gutter.
 */
function spansOf(pieces: Piece[], left: number, width: number): RenderOutput[] {
  const out: RenderOutput[] = [];
  let column = 0;
  let drawn = 0;

  for (let i = 0; i < pieces.length && drawn < width; i++) {
    const piece = pieces[i] as Piece;
    const end = column + stringWidth(piece.text);
    if (end > left) {
      const slice = sliceColumns(piece.text, Math.max(0, left - column), width - drawn);
      if (slice !== '') {
        out.push(h('text', {
          key: i,
          content: slice,
          ...(piece.fg ? { fg: piece.fg } : {}),
          ...(piece.bg ? { bg: piece.bg } : {}),
        }));
        drawn += stringWidth(slice);
      }
    }
    column = end;
  }

  // The row still has to fill its width, or the caret line's background stops
  // short of the right edge and the highlight looks ragged.
  if (drawn < width) out.push(h('box', { flex: 1 }));
  return out;
}

export const CodeEditor = defineComponent<CodeEditorProps>('CodeEditor', (props) => {
  const theme = useTheme();
  const {
    uri = null, value, onChange, lineNumbers = true, tabWidth = 2,
    readonly: readonlyProp, language, kind, onCursor, onSelection, scrollbar = true,
    autoFocus, ...rest
  } = props;

  const doc = useDocument(uri);
  const measured = useMeasure();
  const focus = useFocus({ autoFocus });
  const clipboard = useClipboard();

  // With a document, the buffer is the document. Without one it is here, so a
  // standalone editor works without a caller wiring state back in - an editor
  // that computes the next edit from text a frame out of date eats keystrokes.
  const [local, setLocal] = useState(value ?? '');
  // History follows the buffer. With a document it belongs to the document, so
  // two panes on one file share it and it survives the pane closing; without
  // one there is nowhere else for it to live.
  const [localHistory, setLocalHistory] = useState<History>(EMPTY_HISTORY);
  const text = uri ? doc.content : local;
  const readonly = readonlyProp ?? (uri ? doc.readonly : false);
  const lines = text.split('\n');

  /*
   * The caret and the viewport belong to the panel, not to this component.
   *
   * `ctrl+e` unmounts the editor and mounts a viewer on the same file, and
   * switching tabs unmounts it too; both are exactly when a writer expects to
   * come back to the line they left. The record is shared with any renderer
   * that measures in source lines - `CodeViewer` keeps the same four keys - so
   * reading a file and then editing it does not start over at the top.
   *
   * Outside a panel this is ordinary component state, so a standalone editor
   * in a dialog behaves as it always did.
   */
  const [view, setView] = usePanelState({ line: 0, column: 0, top: 0, left: 0 });
  const cursor: Cursor = { line: view.line, column: view.column };
  const setCursor = (next: Cursor): void => setView({ line: next.line, column: next.column });
  /** Where the selection started, or null when there is no selection. */
  const [anchor, setAnchor] = useState<Cursor | null>(null);
  const top = view.top;
  const setTop = (next: number): void => setView({ top: next });
  /** Leftmost visible cell. The horizontal half of the same viewport. */
  const left = view.left;
  const setLeft = (next: number): void => setView({ left: next });
  /** The column a vertical move aims for, so up/down past a short line recovers. */
  const [goal, setGoal] = useState(0);

  const at = clamp(lines, cursor);
  const held = anchor ? clamp(lines, anchor) : null;
  const selection = held ? span(held, at) : null;
  const selected = selection !== null && !isEmpty(selection);
  const indent = ' '.repeat(Math.max(1, tabWidth));

  const write = (
    next: string,
    to: Cursor,
    options: { kind?: EditKind; anchor?: Cursor | null } = {},
  ): void => {
    if (readonly) return;
    if (uri) {
      doc.set(next, { cursor: at, ...(options.kind ? { coalesce: options.kind } : {}) });
    } else {
      setLocalHistory(record(localHistory, { content: local, cursor: at }, options.kind ?? null));
      setLocal(next);
    }
    onChange?.(next);
    const nextLines = next.split('\n');
    setCursor(clamp(nextLines, to));
    setGoal(clamp(nextLines, to).column);
    // An edit ends the selection unless the caller says otherwise: the text it
    // covered is not there any more.
    setAnchor(options.anchor === undefined ? null : options.anchor);
  };

  /** Put the buffer, and the caret, back where a step says they were. */
  const restore = (to: Snapshot): void => {
    const nextLines = to.content.split('\n');
    const nextCursor = clamp(nextLines, to.cursor ?? at);
    setCursor(nextCursor);
    setGoal(nextCursor.column);
    setAnchor(null);
    onChange?.(to.content);
  };

  const stepBack = (): boolean => {
    if (readonly) return false;
    if (uri) {
      const to = doc.undo(at);
      if (to) restore(to);
      return to !== null;
    }
    const stepped = undo(localHistory, { content: local, cursor: at });
    if (!stepped) return false;
    setLocalHistory(stepped.history);
    setLocal(stepped.to.content);
    restore(stepped.to);
    return true;
  };

  const stepForward = (): boolean => {
    if (readonly) return false;
    if (uri) {
      const to = doc.redo(at);
      if (to) restore(to);
      return to !== null;
    }
    const stepped = redo(localHistory, { content: local, cursor: at });
    if (!stepped) return false;
    setLocalHistory(stepped.history);
    setLocal(stepped.to.content);
    restore(stepped.to);
    return true;
  };

  /**
   * Move the caret.
   *
   * `extend` is the whole of what a shift key does: the anchor is dropped
   * where the caret was standing the first time, and every later move drags
   * the other end. A move without it drops the selection, which is why plain
   * left after a selection is a deselect and not a step back through it.
   */
  const move = (to: Cursor, keepGoal = false, extend = false): void => {
    const next = clamp(lines, to);
    if (extend) setAnchor(held ?? at);
    else setAnchor(null);
    // Moving ends the run. What comes next is a new step back, wherever the
    // caret has gone.
    if (uri) doc.closeEdit();
    else if (localHistory.open !== null) setLocalHistory({ ...localHistory, open: null });
    setCursor(next);
    if (!keepGoal) setGoal(next.column);
    onCursor?.({ line: next.line + 1, column: next.column + 1 });
  };

  // ---------------------------------------------------------------- edits

  /** Delete the selection, and say what the buffer and caret become. */
  const cutSelection = (): { content: string; cursor: Cursor } | null =>
    (selection && selected ? replace(lines, selection, '') : null);

  const insert = (chunk: string): void => {
    if (selection && selected) {
      const { content, cursor: to } = replace(lines, selection, chunk);
      write(content, to, chunk.includes('\n') ? {} : { kind: 'type' });
      return;
    }
    const { before, after } = splitAt(lines, at);
    const parts = chunk.split('\n');
    const head = [...lines.slice(0, at.line), before + (parts[0] ?? '')];
    const tail = [...lines.slice(at.line + 1)];

    if (parts.length === 1) {
      write([...head.slice(0, -1), (head[head.length - 1] ?? '') + after, ...tail].join('\n'),
        { line: at.line, column: before.length + (parts[0]?.length ?? 0) },
        { kind: 'type' });
      return;
    }
    const middle = parts.slice(1, -1);
    const last = parts[parts.length - 1] ?? '';
    // A newline is its own step. Undo that swallowed the paragraph you had
    // just started would be undo nobody presses twice.
    write([...head, ...middle, last + after, ...tail].join('\n'),
      { line: at.line + parts.length - 1, column: last.length });
  };

  const backspace = (): void => {
    const cutting = cutSelection();
    if (cutting) { write(cutting.content, cutting.cursor, { kind: 'delete' }); return; }
    const { before, after } = splitAt(lines, at);
    if (before.length > 0) {
      const next = [...lines];
      next[at.line] = before.slice(0, -1) + after;
      write(next.join('\n'), { line: at.line, column: before.length - 1 }, { kind: 'delete' });
      return;
    }
    // At column zero, backspace joins this line onto the one above it.
    if (at.line === 0) return;
    const previous = lines[at.line - 1] ?? '';
    const next = [...lines];
    next.splice(at.line - 1, 2, previous + after);
    write(next.join('\n'), { line: at.line - 1, column: previous.length });
  };

  const del = (): void => {
    const cutting = cutSelection();
    if (cutting) { write(cutting.content, cutting.cursor, { kind: 'delete' }); return; }
    const { before, after } = splitAt(lines, at);
    if (after.length > 0) {
      const next = [...lines];
      next[at.line] = before + after.slice(1);
      write(next.join('\n'), at, { kind: 'delete' });
      return;
    }
    // At end of line, delete pulls the next line up.
    if (at.line >= lines.length - 1) return;
    const next = [...lines];
    next.splice(at.line, 2, before + (lines[at.line + 1] ?? ''));
    write(next.join('\n'), at);
  };

  // ------------------------------------------------------------ clipboard

  /** What copy and cut take: the selection, or the caret's whole line. */
  const takeable = (): { text: string; range: TextRange } | null => {
    if (selection && selected) return { text: textIn(lines, selection), range: selection };
    const line = lines[at.line];
    if (line === undefined) return null;
    // Nothing selected means the whole line, newline and all, the way every
    // editor does: cut with no selection is "delete this line, but keep it",
    // and asking for it by selecting the line first is three keys for one.
    const last = at.line >= lines.length - 1;
    return {
      text: last ? line : `${line}\n`,
      range: last
        ? { start: { line: at.line, column: 0 }, end: { line: at.line, column: line.length } }
        : { start: { line: at.line, column: 0 }, end: { line: at.line + 1, column: 0 } },
    };
  };

  const copy = (): boolean => {
    const taking = takeable();
    if (!taking || taking.text.length === 0) return false;
    clipboard.write(taking.text);
    return true;
  };

  const cutOut = (): boolean => {
    if (readonly) return false;
    const taking = takeable();
    if (!taking || taking.text.length === 0) return false;
    clipboard.write(taking.text);
    const { content, cursor: to } = replace(lines, taking.range, '');
    write(content, to, { kind: 'delete' });
    return true;
  };

  const shiftLines = (out: boolean): void => {
    const from = selection ? selection.start.line : at.line;
    const to = selection ? selection.end.line : at.line;
    const next = reindent(lines, from, to, indent, out);
    if (next.join('\n') === text) return;
    // The lines stay selected, so indenting twice is two presses rather than
    // a reselect between them.
    write(
      next.join('\n'),
      { line: to, column: (next[to] ?? '').length },
      { anchor: selection ? { line: from, column: 0 } : null },
    );
  };

  // --------------------------------------------------------------- layout

  /*
   * What anything has to say about these lines: git, so far.
   *
   * The editor draws a column of marks and has never heard of git - the same
   * bargain the explorer makes with the tree. The column only exists when
   * something has actually said something, so a file nobody has an opinion
   * about is exactly as wide as it was.
   */
  const marks = useLineMarks(uri);
  const marked = Object.keys(marks).length > 0;
  const markWidth = marked ? 1 : 0;

  const gutterWidth = lineNumbers ? String(lines.length).length + 1 : 0;
  // This component always renders into a `flex: 1` box, so it is layout-sized
  // whether or not the caller said so - and a caller usually cannot: the node
  // comes from the resource registry, which names a component and not a
  // layout. Without this the viewport reports "everything fits", nothing ever
  // scrolls, and the caret walks off the bottom of the pane and straight
  // through the status bar.
  const rows = viewportRows({ flex: 1, ...props }, measured, lines.length);
  const first = Math.max(0, Math.min(top, Math.max(0, lines.length - rows)));

  // Keep the caret on screen. Scrolling is a consequence of moving, not a
  // separate thing to remember to do.
  const visibleTop = at.line < first ? at.line
    : at.line >= first + rows ? at.line - rows + 1
      : first;
  if (visibleTop !== top) setTop(visibleTop);

  /*
   * The horizontal half of the same viewport.
   *
   * Without it a line longer than the pane is handed to the layout whole, and
   * the layout does the only thing it can: shrink every child of the row to
   * fit. That is why a long line came out as fragments with ellipses through
   * it - and why the gutter came out as `3…`, because the line number is a
   * child of that row too and got shrunk along with the code.
   *
   * So the row is sliced to the cells that are visible before it is handed
   * over, exactly as `CodeViewer` does it, and the caret drags the window the
   * way it already drags the vertical one.
   */
  const bars = scrollbar && lines.length > rows;
  const textWidth = Math.max(
    1,
    (measured.width > 0 ? measured.width : 80) - gutterWidth - markWidth - (bars ? 1 : 0),
  );
  const longest = useMemo(
    () => lines.reduce((max, line) => Math.max(max, stringWidth(line)), 0),
    [text],
  );
  const maxLeft = Math.max(0, longest - textWidth);
  /*
   * Where the caret is on screen, which is not where it is in the string.
   *
   * Every edit is an index into the line - that is what makes an edit correct -
   * and every cell is a column on a grid. They are the same number until a
   * line contains something two cells wide, and the window has to be measured
   * in the second one or a CJK line scrolls by the wrong amount.
   */
  const caretColumn = stringWidth((lines[at.line] ?? '').slice(0, at.column));
  const visibleLeft = caretColumn < left ? caretColumn
    : caretColumn >= left + textWidth ? caretColumn - textWidth + 1
      : Math.min(left, maxLeft);
  if (visibleLeft !== left) setLeft(visibleLeft);

  const tokens: SyntaxToken[][] = useHighlight(text, { kind, language, uri: uri ?? undefined });
  const window = lines.slice(visibleTop, visibleTop + rows);

  // ------------------------------------------------------------------ keys

  useInput((event) => {
    const key = event.name;
    const extend = event.shift === true;
    /*
     * Moving the caret is what an *unchorded* arrow does.
     *
     * `alt+left` is an application saying "previous file" over the top of a
     * caret that would otherwise eat it, and `ctrl+pagedown` is a page of
     * files rather than a page of this one. One pair of keys means both, and
     * neither has to be a second-choice chord, because the caret only takes
     * the plain one. Shift is the exception: it is not a chord aimed past this
     * control, it is how a selection is made.
     */
    if (!chorded(event)) {
      if (key === 'up') { move({ line: at.line - 1, column: goal }, true, extend); return true; }
      if (key === 'down') { move({ line: at.line + 1, column: goal }, true, extend); return true; }
      if (key === 'left') {
        if (at.column === 0 && at.line > 0) {
          move({ line: at.line - 1, column: (lines[at.line - 1] ?? '').length }, false, extend);
        } else move({ line: at.line, column: at.column - 1 }, false, extend);
        return true;
      }
      if (key === 'right') {
        if (at.column >= (lines[at.line] ?? '').length && at.line < lines.length - 1) {
          move({ line: at.line + 1, column: 0 }, false, extend);
        } else move({ line: at.line, column: at.column + 1 }, false, extend);
        return true;
      }
      if (key === 'home') { move({ line: at.line, column: 0 }, false, extend); return true; }
      if (key === 'end') { move({ line: at.line, column: (lines[at.line] ?? '').length }, false, extend); return true; }
      if (key === 'pageup') { move({ line: at.line - rows, column: goal }, true, extend); return true; }
      if (key === 'pagedown') { move({ line: at.line + rows, column: goal }, true, extend); return true; }
    }

    // Select all, and copy, work on a file nobody may write.
    if (event.ctrl && (key === 'a' || key === 'A')) {
      const last = lines.length - 1;
      setAnchor({ line: 0, column: 0 });
      setCursor({ line: last, column: (lines[last] ?? '').length });
      setGoal((lines[last] ?? '').length);
      return true;
    }
    /*
     * ctrl+c is quit in a terminal application, and copy in an editor, and
     * both are right. It is copy only while something is selected, so the
     * quit an application binds it to is one escape away and never lost -
     * which is why escape clears a selection below, and is left alone
     * otherwise so a dialog above still closes on it.
     */
    if (event.ctrl && (key === 'c' || key === 'C')) return selected ? copy() : false;
    if (key === 'escape' && selected) { setAnchor(null); return true; }
    /*
     * And escape with nothing selected is how you leave.
     *
     * Tab is a character in an editor - see below - so the key that moves to
     * the next control everywhere else cannot be the one that moves out of
     * this one. Escape is free here: there is no selection to drop, and a
     * dialog above this has its own layer and its own escape.
     *
     * *Backwards*, because an editor is usually the last stop on a screen and
     * moving on from the last stop wraps to the first - which in an
     * application with a menu bar is the menu bar. Leaving an editor and
     * landing on `File`, one keypress from a menu whose last entry is `Quit`,
     * is a way out that walks you into the exit. Back is where you came from.
     */
    if (key === 'escape') { focus.move('previous'); return true; }

    if (readonly) return false;
    // Undo before anything that edits, and before the application's own
    // keybindings, which only see a key the focused control did not take.
    if (event.ctrl && (key === 'z' || key === 'Z')) {
      if (event.shift || key === 'Z') { stepForward(); return true; }
      stepBack();
      return true;
    }
    if (event.ctrl && (key === 'y' || key === 'Y')) { stepForward(); return true; }
    if (event.ctrl && (key === 'x' || key === 'X')) return cutOut();
    if (event.ctrl && (key === 'v' || key === 'V')) {
      const pasted = clipboard.read();
      if (!pasted) return false;
      insert(pasted);
      return true;
    }
    // A bracketed paste arrives as one event carrying the whole text, which is
    // the only reason a hundred-line paste is one undo step and not a hundred.
    if (key === 'paste' && event.char) { insert(event.char); return true; }
    if (key === 'backspace') { backspace(); return true; }
    if (key === 'delete') { del(); return true; }
    // Not a chord: `alt+enter` is an application asking for something over the
    // top of the editor, and an editor that reads `enter` alone puts a newline
    // in the file and swallows the ask.
    if (key === 'enter' && !chorded(event)) { insert('\n'); return true; }
    /*
     * Tab is a tab.
     *
     * It was the key that left the control, which is right for a list and
     * wrong for the one control whose whole job is typing: an editor where the
     * indent key moves focus is an editor you cannot indent in. Escape is the
     * way out instead, above.
     *
     * With a selection it indents the lines it covers rather than replacing
     * them, and shift is outdent either way - on the selection, or on the line
     * the caret is on.
     *
     * A chord is not this: `ctrl+tab` is the application asking for the next
     * file over the top of the editor, and a branch that read `tab` alone
     * swallowed it.
     */
    if (key === 'tab' && !chorded(event)) {
      if (event.shift === true) { shiftLines(true); return true; }
      if (selected) { shiftLines(false); return true; }
      insert(indent);
      return true;
    }
    /*
     * Anything that produced one printable character is that character - as
     * long as nothing was held down with it.
     *
     * A terminal reports `alt+1` as an escape and a `1`, so a branch that only
     * checked ctrl and meta typed the digit and swallowed the chord: `alt+1`
     * put a `1` in the file instead of opening the first tab, and `alt+?` put
     * a `?` in it instead of opening the shortcut sheet.
     */
    if (event.char && !chorded(event) && event.char.length === 1) {
      insert(event.char);
      return true;
    }
    return false;
  }, { focusId: focus.id });

  // Reported from an effect, not from the render that computed it: a callback
  // fired mid-render is a parent setting state while its child is drawing.
  const chars = selection && selected ? textIn(lines, selection).length : 0;
  const spanned = selection && selected ? selection.end.line - selection.start.line + 1 : 0;
  useEffect(() => { onSelection?.({ chars, lines: spanned }); }, [chars, spanned]);

  // The same fact, published where a status bar can read it without knowing
  // which renderer is mounted. `onSelection` stays for a caller holding this
  // component directly; the panel is how everything else hears about it.
  usePanelStatus(chars > 0
    ? `${chars} selected${spanned > 1 ? ` in ${spanned} lines` : ''}`
    : null);

  // --------------------------------------------------------------- render

  const rowNodes = window.map((line, i) => {
    const lineNumber = visibleTop + i;
    const onCaretLine = lineNumber === at.line;

    const gutter = lineNumbers
      ? h('text', {
          content: String(lineNumber + 1).padStart(gutterWidth - 1) + ' ',
          fg: onCaretLine ? 'text' : 'subtle',
          // Stated, so a row too wide for its pane cannot buy space back by
          // squeezing the line number down to an ellipsis.
          width: gutterWidth,
        })
      : null;

    // A glyph as well as a colour: a 16-colour session and a screenshot both
    // lose the colour and neither loses the character. One cell, and the three
    // are ASCII, because a mark that measures two would slide every line in
    // the file sideways on a terminal that disagrees about its width.
    const mark = marked
      ? h('text', {
          content: MARK_GLYPH[marks[lineNumber] as LineMark] ?? ' ',
          fg: MARK_TONE[marks[lineNumber] as LineMark] ?? 'border',
          width: 1,
        })
      : null;

    let pieces = piecesOf(line, tokens[lineNumber], theme.syntax);

    /*
     * The selection is a background, not an inversion.
     *
     * `selected` is the token for a row that carries `inverted` text, and this
     * row carries whatever the highlighter said - so inverting it would either
     * throw the syntax colours away or write them on a colour picked to be
     * written on in one specific ink. `active` is the tint that keeps them.
     */
    if (selection && selected
      && lineNumber >= selection.start.line && lineNumber <= selection.end.line) {
      const from = lineNumber === selection.start.line ? selection.start.column : 0;
      // A selection that runs on past this line took the newline with it, and
      // one cell of highlight is how a reader can see that it did.
      const to = lineNumber === selection.end.line ? selection.end.column : line.length + 1;
      if (to > from) pieces = paint(pieces, from, to, { bg: 'active' });
    }

    // The caret is a cell, drawn by splitting the row around it, because a
    // terminal cursor cannot be relied on to be where a component wants it.
    if (onCaretLine) {
      pieces = paint(pieces, at.column, at.column + 1, { bg: 'cursor', fg: 'inverted' });
    }

    return h('box', {
      key: lineNumber,
      direction: 'row',
      // One row is one line. A row free to be two rows tall is a row that
      // wraps, and a wrapped line is one the caret cannot be moved along.
      height: 1,
      ...(onCaretLine ? { bg: 'surfaceAlt' } : {}),
    },
      mark,
      gutter,
      ...spansOf(pieces, visibleLeft, textWidth));
  });

  return h('box', {
    id: focus.id,
    role: 'textbox',
    direction: 'row',
    flex: 1,
    ...rest,
  },
    h('box', { direction: 'column', flex: 1 }, ...rowNodes),
    bars
      ? h(ScrollThumb, {
          total: lines.length, rows, offset: visibleTop, focused: focus.focused,
        })
      : null);
});

export const EDITOR_COMPONENTS: ComponentDefinition[] = [
  {
    component: 'CodeEditor',
    category: 'resource',
    renderer: { kind: 'function', render: CodeEditor },
    role: 'textbox',
    description: 'Edit a document buffer, with a caret that has a column.',
  },
];

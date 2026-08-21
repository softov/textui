import type { BoxProps } from '@textui/core';
import type { ComponentDefinition, SyntaxToken } from '@textui/core';
import {
  h, defineComponent, useFocus, useHighlight, useInput, useMeasure, useState, useTheme,
  viewportRows,
} from '@textui/core';
import { useDocument } from '../use-document.js';

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
  tabWidth?: number;
  readonly?: boolean;
  /** Ask the syntax registry for a highlighter. */
  language?: string;
  kind?: string;
  onCursor?(cursor: { line: number; column: number }): void;
}

interface Cursor { line: number; column: number }

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

export const CodeEditor = defineComponent<CodeEditorProps>('CodeEditor', (props) => {
  const theme = useTheme();
  const {
    uri = null, value, onChange, lineNumbers = true, tabWidth: _tabWidth = 2,
    readonly: readonlyProp, language, kind, onCursor, ...rest
  } = props;

  const doc = useDocument(uri);
  const measured = useMeasure();
  const focus = useFocus({});

  // With a document, the buffer is the document. Without one it is here, so a
  // standalone editor works without a caller wiring state back in - an editor
  // that computes the next edit from text a frame out of date eats keystrokes.
  const [local, setLocal] = useState(value ?? '');
  const text = uri ? doc.content : local;
  const readonly = readonlyProp ?? (uri ? doc.readonly : false);
  const lines = text.split('\n');

  const [cursor, setCursor] = useState<Cursor>({ line: 0, column: 0 });
  const [top, setTop] = useState(0);
  /** The column a vertical move aims for, so up/down past a short line recovers. */
  const [goal, setGoal] = useState(0);

  const at = clamp(lines, cursor);

  const write = (next: string, to: Cursor): void => {
    if (readonly) return;
    if (uri) doc.set(next); else setLocal(next);
    onChange?.(next);
    const nextLines = next.split('\n');
    setCursor(clamp(nextLines, to));
    setGoal(clamp(nextLines, to).column);
  };

  const move = (to: Cursor, keepGoal = false): void => {
    const next = clamp(lines, to);
    setCursor(next);
    if (!keepGoal) setGoal(next.column);
    onCursor?.({ line: next.line + 1, column: next.column + 1 });
  };

  // ---------------------------------------------------------------- edits

  const insert = (chunk: string): void => {
    const { before, after } = splitAt(lines, at);
    const parts = chunk.split('\n');
    const head = [...lines.slice(0, at.line), before + (parts[0] ?? '')];
    const tail = [...lines.slice(at.line + 1)];

    if (parts.length === 1) {
      write([...head.slice(0, -1), (head[head.length - 1] ?? '') + after, ...tail].join('\n'),
        { line: at.line, column: before.length + (parts[0]?.length ?? 0) });
      return;
    }
    const middle = parts.slice(1, -1);
    const last = parts[parts.length - 1] ?? '';
    write([...head, ...middle, last + after, ...tail].join('\n'),
      { line: at.line + parts.length - 1, column: last.length });
  };

  const backspace = (): void => {
    const { before, after } = splitAt(lines, at);
    if (before.length > 0) {
      const next = [...lines];
      next[at.line] = before.slice(0, -1) + after;
      write(next.join('\n'), { line: at.line, column: before.length - 1 });
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
    const { before, after } = splitAt(lines, at);
    if (after.length > 0) {
      const next = [...lines];
      next[at.line] = before + after.slice(1);
      write(next.join('\n'), at);
      return;
    }
    // At end of line, delete pulls the next line up.
    if (at.line >= lines.length - 1) return;
    const next = [...lines];
    next.splice(at.line, 2, before + (lines[at.line + 1] ?? ''));
    write(next.join('\n'), at);
  };

  // --------------------------------------------------------------- layout

  const gutterWidth = lineNumbers ? String(lines.length).length + 1 : 0;
  const rows = viewportRows(props, measured, lines.length);
  const first = Math.max(0, Math.min(top, Math.max(0, lines.length - rows)));

  // Keep the caret on screen. Scrolling is a consequence of moving, not a
  // separate thing to remember to do.
  const visibleTop = at.line < first ? at.line
    : at.line >= first + rows ? at.line - rows + 1
      : first;
  if (visibleTop !== top) setTop(visibleTop);

  const tokens: SyntaxToken[][] = useHighlight(text, { kind, language, uri: uri ?? undefined });
  const window = lines.slice(visibleTop, visibleTop + rows);

  // ------------------------------------------------------------------ keys

  useInput((event) => {
    const key = event.name;
    if (key === 'up') { move({ line: at.line - 1, column: goal }, true); return true; }
    if (key === 'down') { move({ line: at.line + 1, column: goal }, true); return true; }
    if (key === 'left') {
      if (at.column === 0 && at.line > 0) {
        move({ line: at.line - 1, column: (lines[at.line - 1] ?? '').length });
      } else move({ line: at.line, column: at.column - 1 });
      return true;
    }
    if (key === 'right') {
      if (at.column >= (lines[at.line] ?? '').length && at.line < lines.length - 1) {
        move({ line: at.line + 1, column: 0 });
      } else move({ line: at.line, column: at.column + 1 });
      return true;
    }
    if (key === 'home') { move({ line: at.line, column: 0 }); return true; }
    if (key === 'end') { move({ line: at.line, column: (lines[at.line] ?? '').length }); return true; }
    if (key === 'pageup') { move({ line: at.line - rows, column: goal }, true); return true; }
    if (key === 'pagedown') { move({ line: at.line + rows, column: goal }, true); return true; }

    if (readonly) return false;
    if (key === 'backspace') { backspace(); return true; }
    if (key === 'delete') { del(); return true; }
    if (key === 'enter') { insert('\n'); return true; }
    // Tab is deliberately not indentation. In a terminal UI tab is how you
    // leave a control, and an editor that swallows it is an editor you cannot
    // get out of without knowing a second key. Indent gets its own binding.
    if (key === 'tab') return false;
    // Anything that produced one printable character is that character.
    if (event.char && !event.ctrl && !event.meta && event.char.length === 1) {
      insert(event.char);
      return true;
    }
    return false;
  }, { focusId: focus.id });

  // --------------------------------------------------------------- render

  const rowNodes = window.map((line, i) => {
    const lineNumber = visibleTop + i;
    const onCaretLine = lineNumber === at.line;
    const lineTokens = tokens[lineNumber];

    const gutter = lineNumbers
      ? h('text', {
          content: String(lineNumber + 1).padStart(gutterWidth - 1) + ' ',
          fg: onCaretLine ? 'text' : 'subtle',
        })
      : null;

    // The caret is a cell, drawn by splitting the row around it, because a
    // terminal cursor cannot be relied on to be where a component wants it.
    if (!onCaretLine) {
      return h('box', { key: lineNumber, direction: 'row' },
        gutter,
        lineTokens && lineTokens.length > 0
          ? h('box', { direction: 'row' },
              ...lineTokens.map((token, ti) =>
                h('text', {
                  key: ti,
                  content: token.text,
                  fg: token.scope === 'plain' ? undefined : theme.syntax[token.scope],
                })))
          : h('text', { content: line }));
    }

    const head = line.slice(0, at.column);
    const under = line.slice(at.column, at.column + 1) || ' ';
    const tailText = line.slice(at.column + 1);
    return h('box', { key: lineNumber, direction: 'row', bg: 'surfaceAlt' },
      gutter,
      h('text', { content: head }),
      h('text', { content: under, bg: 'cursor', fg: 'inverted' }),
      h('text', { content: tailText }),
      h('spacer', { flex: 1 }));
  });

  return h('box', {
    id: focus.id,
    role: 'textbox',
    direction: 'column',
    flex: 1,
    ...rest,
  }, ...rowNodes);
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

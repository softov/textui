import type { BoxProps, KeyEvent, SemanticVariant } from '@textui/core';
import {
  defineComponent,
  graphemes,
  h,
  stringWidth,
  useEffect,
  useFocus,
  useInput,
  useMeasure,
  useState,
  useTicker,
} from '@textui/core';

export interface TextAreaProps extends BoxProps {
  value: string;
  onChange(value: string): void;
  /**
   * Enter. A newline is `ctrl+enter`, which is the one people reach for, with
   * `alt+enter` as the one that cannot fail.
   *
   * A terminal has three ways to say `ctrl+enter` and `@textui/terminal`
   * decodes all three: the kitty protocol's `CSI 13;5u`, xterm's
   * `modifyOtherKeys` `CSI 27;5;13~`, and a bare LF - which is what most
   * terminals send, and which is *not* the Return key, because in raw mode
   * Return sends CR.
   *
   * `shift+enter` is not offered. There is no encoding in which it differs
   * from enter, so a field that claimed it would be claiming a key that
   * cannot arrive.
   *
   * Left off, enter inserts a newline like every other key does.
   */
  onSubmit?(value: string): void;
  /** Escape, when there is nothing inside the field to cancel. */
  onCancel?(): void;
  /** Up at the top, down at the bottom: for walking a history. */
  onOverflow?(direction: -1 | 1): void;
  /**
   * Left at the very start, right at the very end.
   *
   * The horizontal pair of `onOverflow`, and separate from it because they
   * mean different things: up and down walk a history, and left off the front
   * of the field is "I am done here" - which is how a composer hands the
   * reader back to what is beside it without them reaching for escape.
   */
  onEdge?(edge: 'start' | 'end'): void;
  placeholder?: string;
  /** Rows before it stops growing and starts scrolling. */
  maxRows?: number;
  maxLength?: number;
  autoFocus?: boolean;
  focusId?: string;
  /**
   * The caret's colour. `cursor` by default, which is the theme's own.
   *
   * A composer usually wants `accent`: the caret is the one thing on the
   * screen saying where typing goes, and the field it sits in is the point of
   * the screen.
   */
  caretTone?: SemanticVariant;
  /**
   * What the caret looks like. An underline under the character it is on by
   * default; `block` fills the cell instead.
   *
   * Both **mark a cell rather than occupying one**. The caret used to be a
   * glyph pushed in between the text before it and the text after, so every
   * character to its right sat one column off from where it would be once the
   * caret moved on, and the row was a cell wider than its own text. On a
   * wrapped row that extra cell is the one that does not fit.
   */
  caretStyle?: 'underline' | 'block';
  /**
   * Blink the caret while the field has the keyboard. On by default.
   *
   * Driven by the animation ticker, so it stops with every other animation -
   * a still, a test and a terminal that has animation off all draw the caret
   * solid rather than at whatever phase the clock happened to be in.
   */
  blink?: boolean;
}

/**
 * A field that is a paragraph.
 *
 * `TextInput` is one line, and a message, a note or a commit body is not. It
 * soft-wraps, grows to what has been typed and then scrolls, keeps the caret
 * visible, and hands back every key it does not want - which is what lets the
 * thing behind it keep its own shortcuts while this has the keyboard.
 *
 * Wrapping means a line is not a row: `maxRows` is a budget of rows, up and
 * down move by row, and the inherited `wrap` prop picks how a line breaks.
 * Any of its `truncate-*` values asks for one row per line instead, with an
 * ellipsis where the text was cut.
 *
 * It takes a printable character before any keybinding sees it, because that
 * is what typing is. That single fact is why an application with one of these
 * cannot have single-letter global commands, and why it does not need to.
 */
export const TextArea = defineComponent<TextAreaProps>('TextArea', (props) => {
  const {
    value, onChange, onSubmit, onCancel, onOverflow, onEdge, placeholder, maxRows = 6,
    maxLength, autoFocus, focusId, disabled, caretTone, blink = true, wrap = 'word',
    caretStyle = 'underline', ...rest
  } = props;

  const focus = useFocus({
    ...(focusId ? { id: focusId } : {}),
    disabled,
    ...(autoFocus ? { autoFocus } : {}),
  });
  const [caret, setCaret] = useState(value.length);
  const [lit, setLit] = useState(true);

  // Only while it has the keyboard, and solid the moment it loses it: a caret
  // blinking in a field nobody is typing into is two carets on one screen.
  useTicker(() => setLit((on) => !on), { fps: 2, enabled: blink && focus.focused });
  useEffect(() => { setLit(true); }, [focus.focused]);

  /**
   * The caret, as a style laid over one cell.
   *
   * `inverse` for a block rather than a background colour, because it swaps
   * whatever the cell already had - a caret over selected or coloured text
   * stays legible instead of painting the theme's cursor colour over it.
   */
  const mark = caretStyle === 'block'
    ? { inverse: true, fg: caretTone ?? 'cursor' }
    : { underline: true, fg: caretTone ?? 'cursor' };

  const chars = graphemes(value);
  const position = Math.min(caret, chars.length);
  const before = chars.slice(0, position).join('');
  const lines = value === '' ? [''] : value.split('\n');
  const caretLine = before.split('\n').length - 1;
  const caretColumn = graphemes(before.split('\n').pop() ?? '').length;

  /*
   * Visual rows, which are not logical lines.
   *
   * Every row was drawn with `truncate: 'end'`, so a line wider than the field
   * came out as its first few words and an ellipsis - text that had been typed
   * and could not be read back. This is the component the docs call "the one
   * that is a paragraph", and a paragraph wraps.
   *
   * So one line can occupy several rows, and everything below counts rows
   * rather than lines: `maxRows`, the scroll offset, up and down. The
   * inherited `wrap` prop chooses how, and any of the `truncate-*` values ask
   * for the old single-row-per-line behaviour back.
   *
   * The width is the layout's, so it arrives a frame late. Until it does it is
   * 0 and nothing wraps, which is precisely the behaviour above - and the pass
   * that `useMeasure` schedules draws the wrapped version.
   */
  const width = useMeasure().width;
  const mode = width > 0 && (wrap === 'word' || wrap === 'char') ? wrap : 'none';

  const visual: { line: number; start: number; cells: string[] }[] = [];
  lines.forEach((line, index) => {
    const cells = graphemes(line);
    const starts = mode === 'none' ? [0] : breakColumns(cells, width, mode);
    starts.forEach((start, i) => {
      visual.push({ line: index, start, cells: cells.slice(start, starts[i + 1] ?? cells.length) });
    });

    // A caret at the end of a row that is already full has no cell of its own
    // to mark and no room for a spare one, so it belongs on a new empty row -
    // which is where the next character was going to land anyway.
    if (mode !== 'none' && index === caretLine && caretColumn === cells.length) {
      const last = visual[visual.length - 1];
      if (last && rowWidth(last.cells) >= width) {
        visual.push({ line: index, start: cells.length, cells: [] });
      }
    }
  });

  // The *last* row starting at or before the caret. With the caret exactly on
  // a break that is the row it begins, not the one it just filled - which is
  // where the caret goes when a word has just been pushed onto a new row.
  let caretRow = 0;
  visual.forEach((row, i) => {
    if (row.line === caretLine && row.start <= caretColumn) caretRow = i;
  });

  const rows = Math.min(maxRows, Math.max(1, visual.length));
  const first = Math.max(0, Math.min(caretRow - rows + 1, visual.length - rows));

  const lineStart = (index: number): number =>
    lines.slice(0, index).reduce((n, line) => n + graphemes(line).length + 1, 0);

  /** The caret's column within its own row, carried onto another row. */
  const rowCaret = (index: number): number => {
    const row = visual[index];
    if (!row) return position;
    const column = Math.min(caretColumn - (visual[caretRow]?.start ?? 0), row.cells.length);
    return lineStart(row.line) + row.start + column;
  };

  const replace = (next: string, at: number): void => {
    const capped = maxLength !== undefined ? next.slice(0, maxLength) : next;
    onChange(capped);
    setCaret(Math.max(0, Math.min(graphemes(capped).length, at)));
  };

  const insert = (text: string): void => {
    const inserted = graphemes(text);
    replace([...chars.slice(0, position), ...inserted, ...chars.slice(position)].join(''), position + inserted.length);
  };

  useInput(
    (event: KeyEvent) => {
      if (disabled) return false;

      switch (event.name) {
        case 'left':
          // Off the front of the field is the caller's key, the same way up at
          // the top is - so "left, left, left" walks out of the composer.
          if (position === 0) { onEdge?.('start'); return true; }
          setCaret(position - 1);
          return true;
        case 'right':
          if (position === chars.length) { onEdge?.('end'); return true; }
          setCaret(position + 1);
          return true;
        case 'home': setCaret(lineStart(caretLine)); return true;
        case 'end': setCaret(lineStart(caretLine) + graphemes(lines[caretLine] ?? '').length); return true;

        // By *row*, not by line. In a wrapped paragraph moving by line jumps
        // the whole paragraph, and what is above the caret on the screen is
        // the row above it.
        case 'up': {
          // At the top there is nowhere to go inside the field, so the caller
          // gets the key - which is where "the last thing you sent" comes from.
          if (caretRow === 0) { onOverflow?.(-1); return true; }
          setCaret(rowCaret(caretRow - 1));
          return true;
        }
        case 'down': {
          if (caretRow === visual.length - 1) { onOverflow?.(1); return true; }
          setCaret(rowCaret(caretRow + 1));
          return true;
        }

        case 'backspace':
          if (position > 0) replace([...chars.slice(0, position - 1), ...chars.slice(position)].join(''), position - 1);
          return true;
        case 'delete':
          if (position < chars.length) replace([...chars.slice(0, position), ...chars.slice(position + 1)].join(''), position);
          return true;

        case 'enter':
          // Alt or ctrl says "a line, not a message". `shift+enter` is not in
          // this list on purpose: most terminals cannot tell it from enter, so
          // binding it produces a key that works on one machine.
          if (!onSubmit || event.alt || event.ctrl) { insert('\n'); return true; }
          onSubmit(value);
          setCaret(0);
          return true;

        case 'escape': onCancel?.(); return true;
        case 'paste': insert(event.char ?? ''); return true;
        default: break;
      }

      // ctrl+j, for the one case where it is a key of its own: with the kitty
      // protocol on it arrives as `CSI 106;5u` and is named `j`. Without it
      // ctrl+j is 0x0a, the same byte as ctrl+enter, and the case above has
      // already taken it - there is no encoding in which those two differ.
      if (event.name === 'j' && event.ctrl) { insert('\n'); return true; }

      if (event.char && !event.ctrl && !event.alt && !event.meta) {
        insert(event.char);
        return true;
      }
      return false;
    },
    { focusId: focus.id, enabled: !disabled },
  );

  const shown = visual.slice(first, first + rows);

  // The row count fixes the *content*, on an inner box, and the outer one
  // sizes to it.
  //
  // `height: rows` on the outer box meant the rows and the border had to share
  // one allowance: `<TextArea border="single"/>` came out as a top border and
  // nothing else, because one row is what the field asked for and the border
  // spent it. Nobody saw it because a field without a border looks the same
  // either way, and `TextInput` fixes no height at all.
  return h('box', {
    id: focus.id,
    role: 'textbox',
    label: placeholder,
    direction: 'column',
    ...rest,
  }, h('box', { direction: 'column', height: rows },
    value === ''
      // The placeholder stays while the field is focused and empty: it is the
      // only thing on screen saying what enter will do, and hiding it when the
      // caret arrives hides it exactly when it is read.
      ? (() => {
        // The caret sits on the placeholder's first cell rather than in front
        // of it: a caret that pushed the placeholder along moved the one piece
        // of text on the screen every time the field was focused.
        const hint = graphemes(placeholder ?? '');
        const head = hint.length > 0 ? (hint[0] as string) : ' ';
        return h('box', { direction: 'row' },
          h('text', {
            content: head,
            // The placeholder keeps its own colour and only takes the mark:
            // recolouring it would make the first letter of the hint the one
            // bright thing in an empty field.
            ...(focus.focused && lit ? { ...mark, fg: 'subtle' as const } : { fg: 'subtle' as const }),
          }),
          h('text', { content: hint.slice(1).join(''), fg: 'subtle', flex: 1, truncate: 'end' }));
      })()
      : shown.map((row, i) => {
        const index = first + i;
        const text = row.cells.join('');
        if (index !== caretRow || !focus.focused) {
          return h('text', { key: index, content: text === '' ? ' ' : text, wrap: 'none', truncate: 'end' });
        }
        // The caret's column inside this row. The row has already been broken
        // to the width it will be drawn at, so the split lands where it looks.
        //
        // Three parts, and the middle one is the cell the caret is *on* - not
        // an extra cell between them. Past the last character there is nothing
        // to mark, so a space stands in; that is the one case where the caret
        // adds a column, and it adds it at the end where nothing moves.
        const at = caretColumn - row.start;
        return h('box', { key: index, direction: 'row' },
          h('text', { content: row.cells.slice(0, at).join('') }),
          h('text', { content: row.cells[at] ?? ' ', ...(lit ? mark : {}) }),
          h('text', { content: row.cells.slice(at + 1).join(''), flex: 1, truncate: 'end' }));
      }),
  ));
});

/**
 * Where a line breaks, as columns into its own grapheme array.
 *
 * One entry per visual row and always starting at 0, which is what makes a
 * wrapped row addressable: a caret is a character offset, so a wrap that only
 * returned strings could not say which offset a row begins at. `wrapText` in
 * core returns strings and trims each one, and both of those lose the mapping.
 *
 * Nothing is trimmed here for the same reason. A trailing space is a character
 * somebody typed and can delete, so the row it sits on has to contain it -
 * otherwise the caret drifts one cell from the text for the rest of the line.
 *
 * Cells rather than characters throughout: a wide glyph is two columns.
 */
function breakColumns(cells: string[], width: number, mode: 'word' | 'char'): number[] {
  if (width <= 0 || cells.length === 0) return [0];

  const starts = [0];
  let start = 0;
  let used = 0;
  // The last space on the row so far, and -1 once a break has consumed it.
  let space = -1;

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i] as string;
    const cellWidth = stringWidth(cell);

    if (used + cellWidth > width && i > start) {
      // Break after the last space, or mid-word when the row has none - a word
      // longer than the field has to break somewhere, and `space > start`
      // rather than `>=` keeps a row that begins with a space from being one.
      const at = mode === 'word' && space > start ? space + 1 : i;
      starts.push(at);
      start = at;
      space = -1;
      used = 0;
      for (let j = at; j < i; j++) used += stringWidth(cells[j] as string);
    }

    if (/\s/.test(cell)) space = i;
    used += cellWidth;
  }

  return starts;
}

/** A row's width in cells, which is not its length in characters. */
function rowWidth(cells: string[]): number {
  let width = 0;
  for (const cell of cells) width += stringWidth(cell);
  return width;
}

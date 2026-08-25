import type { BoxProps, KeyEvent, MouseEvent, SemanticVariant, Style } from '@textui/core';
import {
  defineComponent,
  graphemes,
  h,
  stringWidth,
  useClipboard,
  useEffect,
  useFocus,
  useInput,
  useMeasure,
  useRef,
  useState,
  useTheme,
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
   * What the caret looks like. **The theme's `cursor` by default**, so the
   * drawn caret and the terminal's own are the same shape, and an underline
   * when the theme leaves it to the terminal.
   *
   * Both **mark a cell rather than occupying one**. The caret used to be a
   * glyph pushed in between the text before it and the text after, so every
   * character to its right sat one column off from where it would be once the
   * caret moved on, and the row was a cell wider than its own text. On a
   * wrapped row that extra cell is the one that does not fit.
   *
   * That is also why the theme's `bar` arrives here as an underline: a bar
   * *between* two characters is exactly the caret this one is not.
   */
  caretStyle?: 'underline' | 'block';
  /**
   * Put a selection on the system clipboard as it is made. On by default.
   *
   * Selecting with the mouse is how text leaves a terminal, and an application
   * that reports mouse events has taken the terminal's own select-and-copy
   * away - so it owes one back. The copy goes out over OSC 52 and into the
   * store, which is the half a paste inside the application can read.
   */
  copyOnSelect?: boolean;
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
    caretStyle, copyOnSelect = true, ...rest
  } = props;

  const theme = useTheme();
  const clipboard = useClipboard();
  const focus = useFocus({
    ...(focusId ? { id: focusId } : {}),
    disabled,
    ...(autoFocus ? { autoFocus } : {}),
  });
  const [caret, setCaret] = useState(value.length);
  const [lit, setLit] = useState(true);

  /**
   * Where the selection was started from; `null` when there is none.
   *
   * The caret is the other end, so a selection is a pair of offsets that
   * remembers which way round it was made - which is what lets shift+left
   * shrink a rightward selection instead of starting a new one.
   *
   * Kept in a ref as well because a drag can outrun the frame loop: `down`
   * and `up` can both land inside one frame, and the handler that has to
   * decide whether anything was selected would be reading last frame's state.
   */
  const anchorRef = useRef<number | null>(null);
  /**
   * The last press, so a second one on the same cell can be told from a first.
   *
   * A terminal has no notion of a double click - it reports presses - so the
   * count is kept here and reset by either moving or waiting.
   */
  const repeat = useRef<{ at: number; x: number; y: number; count: number; dragged: boolean }>(
    { at: Number.NEGATIVE_INFINITY, x: -1, y: -1, count: 0, dragged: false },
  );
  const [anchor, setAnchorState] = useState<number | null>(null);
  const setAnchor = (next: number | null): void => {
    anchorRef.current = next;
    setAnchorState(next);
  };

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
  // `bar` has no drawn form that does not occupy a cell of its own, so it
  // marks the cell the way an underline does - which is what a bar caret
  // looks like anyway once it has nowhere of its own to stand.
  const shape = caretStyle ?? (theme.cursor === 'block' ? 'block' : 'underline');
  const mark: Style = shape === 'block'
    ? { inverse: true, fg: caretTone ?? 'cursor' }
    : { underline: true, fg: caretTone ?? 'cursor' };

  const chars = graphemes(value);
  const position = Math.min(caret, chars.length);

  /*
   * The selection, as the two offsets it covers.
   *
   * Clamped against the value the same way the caret is: `value` is a prop, so
   * it can be replaced under a live selection - a history walked with up and
   * down does exactly that - and an anchor past the end of the new text would
   * select backwards into nothing.
   */
  const anchoredAt = anchor === null ? null : Math.min(anchor, chars.length);
  const selectionStart = anchoredAt === null ? position : Math.min(anchoredAt, position);
  const selectionEnd = anchoredAt === null ? position : Math.max(anchoredAt, position);
  const selected = selectionEnd > selectionStart;

  /**
   * How a selected cell is drawn.
   *
   * The same pair a selected list row uses, and dimmer once the field loses
   * the keyboard: a selection left visible in an unfocused field says what is
   * on the clipboard, and saying it as loudly as the live one would put two
   * selections on the screen.
   */
  const selectionStyle: Style = focus.focused
    ? { bg: 'selected', fg: 'inverted' }
    : { bg: 'active' };

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
  // The content rect, not the border box: rows are drawn inside the padding,
  // so this is the origin a pointer has to be measured against.
  const rect = useMeasure();
  const width = rect.width;
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

  /**
   * The offset a pointer landed on.
   *
   * Cells rather than characters: a wide glyph is two columns, so the column
   * a click is in is not its index in the row. Past the end of a row the
   * caret goes after its last character, which is where a click in the empty
   * part of a line is asking for.
   */
  const offsetAt = (cellX: number, rowIndex: number): number => {
    const row = visual[Math.max(0, Math.min(rowIndex, visual.length - 1))];
    if (!row) return position;
    let used = 0;
    let column = row.cells.length;
    for (let i = 0; i < row.cells.length; i++) {
      const w = stringWidth(row.cells[i] as string);
      // The half-way point: clicking the right half of a glyph puts the caret
      // after it, which is what every other editor does.
      if (cellX < used + w - (w > 1 ? 0 : 0.5)) { column = i; break; }
      used += w;
    }
    return lineStart(row.line) + row.start + column;
  };

  const replace = (next: string, at: number): void => {
    const capped = maxLength !== undefined ? next.slice(0, maxLength) : next;
    setAnchor(null);
    onChange(capped);
    setCaret(Math.max(0, Math.min(graphemes(capped).length, at)));
  };

  /** Typing over a selection replaces it - which is what deletes it, too. */
  const insert = (text: string): void => {
    const inserted = graphemes(text);
    replace(
      [...chars.slice(0, selectionStart), ...inserted, ...chars.slice(selectionEnd)].join(''),
      selectionStart + inserted.length,
    );
  };

  /**
   * Move the caret, taking the selection with it when shift is held.
   *
   * Without shift the selection collapses, because that is what an arrow key
   * means everywhere: stop selecting, and go here.
   */
  const move = (to: number, extend: boolean): void => {
    if (!extend) { setAnchor(null); setCaret(to); return; }

    const from = anchorRef.current ?? position;
    if (anchorRef.current === null) setAnchor(from);
    setCaret(to);
    // A selection made with the keyboard is a selection, and goes the same
    // place one made with the mouse goes. Copying only on a mouse release
    // meant shift+right showed something highlighted that was not on the
    // clipboard - which is a selection you have to redo with the mouse.
    copy(chars.slice(Math.min(from, to), Math.max(from, to)).join(''));
  };

  const copy = (text: string): void => {
    if (copyOnSelect && text !== '') clipboard.write(text);
  };

  /** Select `[from, to)`, and copy it - a word picked out is a word taken. */
  const select = (from: number, to: number): void => {
    setAnchor(from);
    setCaret(to);
    copy(chars.slice(from, to).join(''));
  };

  /**
   * The run a double click means.
   *
   * Letters with letters, spaces with spaces, punctuation with punctuation -
   * so a double click in the gap between two words takes the gap rather than
   * one of the words, which is what makes "select the word, then extend"
   * behave. A newline is a class of its own and joins nothing: a word
   * selection that ran across one would be a paragraph, and there is a
   * separate gesture for that.
   */
  const runAt = (at: number): [number, number] => {
    if (chars.length === 0) return [0, 0];
    const index = Math.max(0, Math.min(at, chars.length - 1));
    const kind = classOf(chars[index] as string);
    if (kind === 'break') return [index, index + 1];

    let from = index;
    while (from > 0 && classOf(chars[from - 1] as string) === kind) from -= 1;
    let to = index + 1;
    while (to < chars.length && classOf(chars[to] as string) === kind) to += 1;
    return [from, to];
  };

  /**
   * The offset one word away, in `step`'s direction.
   *
   * Skips whatever is under the caret to the far side of it, then any run of
   * whitespace - so ctrl+right lands at the start of the next word rather than
   * in the gap before it, which is where "skip the run you are in" alone would
   * leave it.
   *
   * A newline is one step of its own. Walking right stops at the end of the
   * line, and the next press crosses to the start of the one below - rather
   * than the break and the first word going by together. The end of a line is
   * somewhere people mean to be, which is why it costs a press to leave.
   */
  const wordStep = (from: number, step: -1 | 1): number => {
    let at = from;
    const peek = (): string | undefined => chars[step < 0 ? at - 1 : at];

    if (step < 0) {
      while (at > 0 && classOf(peek() as string) === 'space') at -= 1;
      if (at > 0 && classOf(peek() as string) === 'break') return at - 1;
      const kind = at > 0 ? classOf(peek() as string) : 'word';
      while (at > 0 && classOf(peek() as string) === kind) at -= 1;
      return at;
    }

    if (at < chars.length && classOf(peek() as string) === 'break') return at + 1;
    const kind = at < chars.length ? classOf(peek() as string) : 'word';
    while (at < chars.length && classOf(peek() as string) === kind) at += 1;
    while (at < chars.length && classOf(peek() as string) === 'space') at += 1;
    return at;
  };

  /**
   * The logical line a triple click means - with its newline, when it has one.
   *
   * The line rather than the row: a wrapped paragraph is one thing somebody
   * wrote, and taking the third of it that happened to fit on one row is not
   * a selection anybody asked for.
   */
  const lineAt = (at: number): [number, number] => {
    const index = chars.slice(0, at).join('').split('\n').length - 1;
    const start = lineStart(index);
    const end = start + graphemes(lines[index] ?? '').length;
    return [start, Math.min(chars.length, end + (index < lines.length - 1 ? 1 : 0))];
  };

  useInput(
    (event: KeyEvent) => {
      if (disabled) return false;

      switch (event.name) {
        case 'left':
          // A word at a time, the way every field with a caret in it does.
          if (event.ctrl || event.alt) { move(wordStep(position, -1), event.shift); return true; }
          // A plain arrow collapses to the edge it is moving towards rather
          // than stepping one from the caret: with three words selected, left
          // means "back to the start of that", not "one before wherever the
          // drag happened to end".
          if (selected && !event.shift) { move(selectionStart, false); return true; }
          // Off the front of the field is the caller's key, the same way up at
          // the top is - so "left, left, left" walks out of the composer.
          if (position === 0) { if (!event.shift) setAnchor(null); onEdge?.('start'); return true; }
          move(position - 1, event.shift);
          return true;
        case 'right':
          if (event.ctrl || event.alt) { move(wordStep(position, 1), event.shift); return true; }
          if (selected && !event.shift) { move(selectionEnd, false); return true; }
          if (position === chars.length) { if (!event.shift) setAnchor(null); onEdge?.('end'); return true; }
          move(position + 1, event.shift);
          return true;
        case 'home': move(lineStart(caretLine), event.shift); return true;
        case 'end':
          move(lineStart(caretLine) + graphemes(lines[caretLine] ?? '').length, event.shift);
          return true;

        // By *row*, not by line. In a wrapped paragraph moving by line jumps
        // the whole paragraph, and what is above the caret on the screen is
        // the row above it.
        case 'up': {
          // At the top there is nowhere to go inside the field, so the caller
          // gets the key - which is where "the last thing you sent" comes from.
          if (caretRow === 0) { if (!event.shift) setAnchor(null); onOverflow?.(-1); return true; }
          move(rowCaret(caretRow - 1), event.shift);
          return true;
        }
        case 'down': {
          if (caretRow === visual.length - 1) { if (!event.shift) setAnchor(null); onOverflow?.(1); return true; }
          move(rowCaret(caretRow + 1), event.shift);
          return true;
        }

        case 'backspace':
          // A selection is what gets deleted when there is one - the character
          // before the caret is only the fallback.
          if (selected) { insert(''); return true; }
          if (position > 0) replace([...chars.slice(0, position - 1), ...chars.slice(position)].join(''), position - 1);
          return true;
        case 'delete':
          if (selected) { insert(''); return true; }
          if (position < chars.length) replace([...chars.slice(0, position), ...chars.slice(position + 1)].join(''), position);
          return true;

        case 'enter':
          // Alt or ctrl says "a line, not a message". `shift+enter` is not in
          // this list on purpose: most terminals cannot tell it from enter, so
          // binding it produces a key that works on one machine.
          if (!onSubmit || event.alt || event.ctrl) { insert('\n'); return true; }
          onSubmit(value);
          setAnchor(null);
          setCaret(0);
          return true;

        // `onCancel` is documented as escape *when there is nothing inside the
        // field to cancel*, and a live selection is something inside the field
        // to cancel.
        case 'escape':
          if (selected) { setAnchor(null); return true; }
          onCancel?.();
          return true;
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
  /**
   * A click puts the caret where it landed; a drag selects to where it got to.
   *
   * `onMouse` rather than `onClick` because a field that is not focused has to
   * take the keyboard first - otherwise the caret moves somewhere the next
   * keystroke will not go - and because `onClick` is the button going down,
   * which is a third of a drag.
   *
   * The drag arrives at all because the application holds the pointer for
   * whoever took the button down.
   *
   * The row is deliberately not clamped to what is on screen. Dragging below
   * the field asks for a row below the field, the caret follows it there, and
   * the scroll offset is computed from the caret - so a selection dragged off
   * the bottom scrolls the field, which is the whole reason to drag off the
   * bottom. `offsetAt` clamps to the text, and that is the only clamp there is.
   */
  const pointerOffset = (event: MouseEvent): number => {
    const column = Math.max(0, event.x - rect.x);
    return Math.max(0, Math.min(chars.length, offsetAt(column, first + (event.y - rect.y))));
  };

  const onMouse = (event: MouseEvent): boolean => {
    if (disabled || event.button !== 'left' || rect.width <= 0) return false;

    switch (event.action) {
      case 'down': {
        // Only a press *inside* the field starts anything. Drags and releases
        // are not tested that way: by then the pointer is wherever it has got
        // to, and the gesture is this field's regardless.
        if (event.x < rect.x || event.y < rect.y) return false;
        if (!focus.focused) focus.focus();
        const at = pointerOffset(event);

        // One cell, one window, or it is a new gesture. Position matters as
        // much as time: two clicks half a second apart on different words are
        // two clicks, and a terminal that reports no timestamp gets `0` for
        // both, which lands on "same instant" - so the cell is what saves it.
        const stamp = event.at ?? 0;
        const same = event.x === repeat.current.x && event.y === repeat.current.y;
        const soon = stamp - repeat.current.at <= 450;
        const count = same && soon ? (repeat.current.count % 3) + 1 : 1;
        repeat.current = { at: stamp, x: event.x, y: event.y, count, dragged: false };

        if (count === 2) { const [from, to] = runAt(at); select(from, to); return true; }
        if (count === 3) { const [from, to] = lineAt(at); select(from, to); return true; }

        // Anchored, but empty - so a click that never turns into a drag is a
        // caret and nothing else.
        setAnchor(at);
        setCaret(at);
        return true;
      }
      case 'drag':
        repeat.current.dragged = true;
        setCaret(pointerOffset(event));
        return true;
      case 'up': {
        // A word or a line was decided when the button went down, and the
        // release is the same press ending. Re-reading the pointer here would
        // collapse the selection back to the cell it was made from - which is
        // what "double click selects two letters" was.
        if (repeat.current.count > 1 && !repeat.current.dragged) return true;

        const at = pointerOffset(event);
        const from = anchorRef.current;
        setCaret(at);
        if (from === null || from === at) { setAnchor(null); return true; }
        copy(chars.slice(Math.min(from, at), Math.max(from, at)).join(''));
        return true;
      }
      default:
        return false;
    }
  };

  return h('box', {
    id: focus.id,
    role: 'textbox',
    label: placeholder,
    direction: 'column',
    onMouse,
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
        const base = lineStart(row.line) + row.start;
        const end = base + row.cells.length;
        // The caret's column inside this row. The row has already been broken
        // to the width it will be drawn at, so the split lands where it looks.
        const at = index === caretRow && focus.focused ? caretColumn - row.start : -1;

        // One entry per drawn cell, carrying what is true of it. The caret is
        // a cell the row already has rather than an extra one between two of
        // them - that is what keeps a wrapped row as wide as its own text.
        const cells = row.cells.map((char, column) => ({
          char,
          selected: selected && base + column >= selectionStart && base + column < selectionEnd,
          caret: column === at,
        }));

        // The cell after the last character. It exists when the caret is past
        // the end and has nothing to mark, when the newline this row ends on
        // is inside the selection - a selected line break has to show, or
        // three selected lines read as three unrelated runs - and when the row
        // is empty and needs something to occupy it.
        const breaks = visual[index + 1]?.line !== row.line;
        const tail = {
          char: ' ',
          selected: selected && breaks && end >= selectionStart && end < selectionEnd,
          caret: at === row.cells.length,
        };
        if (tail.caret || tail.selected || cells.length === 0) cells.push(tail);

        if (!cells.some((cell) => cell.selected || cell.caret)) {
          return h('text', { key: index, content: cells.map((c) => c.char).join(''), wrap: 'none', truncate: 'end' });
        }

        // Neighbouring cells that look the same are drawn as one run, so a
        // selected row is a handful of nodes rather than one per column.
        const runs: { content: string; style: Style }[] = [];
        let previous = '';
        for (const cell of cells) {
          const lift = `${cell.selected ? 's' : ''}${cell.caret && lit ? 'c' : ''}`;
          const last = runs[runs.length - 1];
          if (last && lift === previous) last.content += cell.char;
          else {
            runs.push({
              content: cell.char,
              style: {
                ...(cell.selected ? selectionStyle : {}),
                ...(cell.caret && lit ? mark : {}),
              },
            });
            previous = lift;
          }
        }

        return h('box', { key: index, direction: 'row' },
          ...runs.map((run, r) => h('text', {
            key: r,
            content: run.content,
            wrap: 'none',
            truncate: 'end',
            ...run.style,
          })),
          // The rest of the row, unstyled: flexing the last run instead would
          // drag a selection's background out to the edge of the field.
          h('text', { key: 'rest', content: '', flex: 1, truncate: 'end' }));
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

/**
 * What kind of character this is, for the purpose of "the run around it".
 *
 * Four classes, and a newline is its own: joining it to the whitespace either
 * side would make a double click in the margin select across two lines.
 */
function classOf(cell: string): 'word' | 'space' | 'break' | 'other' {
  if (cell === '\n') return 'break';
  if (/\s/.test(cell)) return 'space';
  return /[\p{L}\p{N}_]/u.test(cell) ? 'word' : 'other';
}

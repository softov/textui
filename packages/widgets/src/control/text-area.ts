import type { BoxProps, KeyEvent, SemanticVariant } from '@textui/core';
import {
  defineComponent,
  graphemes,
  h,
  useEffect,
  useFocus,
  useInput,
  useState,
  useTheme,
  useTicker,
} from '@textui/core';

export interface TextAreaProps extends BoxProps {
  value: string;
  onChange(value: string): void;
  /**
   * Enter. A newline is `alt+enter`, because in every place a multi-line field
   * is worth having, enter already means "done".
   *
   * `ctrl+enter` works too, wherever the terminal can say it. Most cannot:
   * without the kitty keyboard protocol ctrl+enter arrives as the same byte as
   * enter, and so does `shift+enter` - which is why neither can be the one you
   * document. Alt is an escape prefix and survives everywhere.
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
 * grows to what has been typed and then scrolls, keeps the caret visible, and
 * hands back every key it does not want - which is what lets the thing behind
 * it keep its own shortcuts while this has the keyboard.
 *
 * It takes a printable character before any keybinding sees it, because that
 * is what typing is. That single fact is why an application with one of these
 * cannot have single-letter global commands, and why it does not need to.
 */
export const TextArea = defineComponent<TextAreaProps>('TextArea', (props) => {
  const theme = useTheme();
  const {
    value, onChange, onSubmit, onCancel, onOverflow, onEdge, placeholder, maxRows = 6,
    maxLength, autoFocus, focusId, disabled, caretTone, blink = true, ...rest
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

  const chars = graphemes(value);
  const position = Math.min(caret, chars.length);
  const before = chars.slice(0, position).join('');
  const lines = value === '' ? [''] : value.split('\n');
  const caretLine = before.split('\n').length - 1;
  const caretColumn = graphemes(before.split('\n').pop() ?? '').length;

  const rows = Math.min(maxRows, Math.max(1, lines.length));
  const first = Math.max(0, Math.min(caretLine - rows + 1, lines.length - rows));

  const lineStart = (index: number): number =>
    lines.slice(0, index).reduce((n, line) => n + graphemes(line).length + 1, 0);

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

        case 'up': {
          // At the top there is nowhere to go inside the field, so the caller
          // gets the key - which is where "the last thing you sent" comes from.
          if (caretLine === 0) { onOverflow?.(-1); return true; }
          const target = caretLine - 1;
          setCaret(lineStart(target) + Math.min(caretColumn, graphemes(lines[target] ?? '').length));
          return true;
        }
        case 'down': {
          if (caretLine === lines.length - 1) { onOverflow?.(1); return true; }
          const target = caretLine + 1;
          setCaret(lineStart(target) + Math.min(caretColumn, graphemes(lines[target] ?? '').length));
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

      if (event.name === 'j' && event.ctrl) { insert('\n'); return true; }

      if (event.char && !event.ctrl && !event.alt && !event.meta) {
        insert(event.char);
        return true;
      }
      return false;
    },
    { focusId: focus.id, enabled: !disabled },
  );

  const shown = lines.slice(first, first + rows);

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
      ? h('box', { direction: 'row' },
          focus.focused
            ? h('text', { content: lit ? theme.glyphs.caret : ' ', fg: caretTone ?? 'cursor' })
            : null,
          h('text', { content: placeholder ?? '', fg: 'subtle', flex: 1, truncate: 'end' }))
      : shown.map((line, i) => {
        const index = first + i;
        if (index !== caretLine || !focus.focused) {
          return h('text', { key: index, content: line === '' ? ' ' : line, wrap: 'none', truncate: 'end' });
        }
        const cells = graphemes(line);
        return h('box', { key: index, direction: 'row' },
          h('text', { content: cells.slice(0, caretColumn).join('') }),
          h('text', { content: lit ? theme.glyphs.caret : ' ', fg: caretTone ?? 'cursor' }),
          h('text', { content: cells.slice(caretColumn).join(''), flex: 1, truncate: 'end' }));
      }),
  ));
});

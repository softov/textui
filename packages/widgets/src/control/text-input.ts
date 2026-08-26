import type { KeyEvent, MouseEvent } from '@textui/core';
import {
  defineComponent,
  graphemes,
  h,
  sliceColumns,
  stringWidth,
  useFocus,
  useInput,
  useMeasure,
  useState,
  useTheme,
} from '@textui/core';
import type { TextInputProps } from './shared.js';

/**
 * A single-line text field.
 *
 * The caret is a real cursor position published to the renderer when the
 * terminal has a cursor, and a drawn glyph when it does not - so a text field
 * still shows where typing lands over a link that swallowed cursor control.
 */
export const TextInput = defineComponent<TextInputProps>('TextInput', (props) => {
  const theme = useTheme();
  const {
    value, onChange, onSubmit, onEdge, placeholder, label, hideLabel, mask, maxLength,
    autoFocus, search, disabled, focusId, ...rest
  } = props;
  const inlineLabel = label && !search && !hideLabel ? label : undefined;

  const focus = useFocus({ ...(focusId ? { id: focusId } : {}), disabled, autoFocus });
  const measured = useMeasure();
  const [caret, setCaret] = useState(value.length);
  const [scroll, setScroll] = useState(0);

  const chars = graphemes(value);
  const position = Math.min(caret, chars.length);
  const shown = mask ? mask.repeat(chars.length) : value;
  const empty = shown === '';

  // Everything drawn before the value pushes the caret along with it. Counting
  // the search glyph but not the label is what leaves the caret several cells
  // to the left of where the typing lands.
  const lead =
    (search ? stringWidth(theme.glyphs.search) + 1 : 0) +
    (inlineLabel ? stringWidth(inlineLabel) + 1 : 0);

  const total = stringWidth(shown);
  const field = measured.width > 0
    ? Math.max(1, measured.width - lead)
    : Math.max(1, total);

  // Cells, not characters: a wide glyph is two columns of caret travel.
  const columnAt = (index: number): number => stringWidth(chars.slice(0, index).join(''));
  const caretColumn = columnAt(position);
  const anchored = Math.max(0, Math.min(scroll, caretColumn, Math.max(0, total - field + 1)));
  const start = caretColumn > anchored + field - 1 ? caretColumn - field + 1 : anchored;

  /**
   * Move the caret and scroll the field just enough to keep it in view.
   *
   * `limit` is the length the value is about to have: `chars` still holds the
   * old one during the render that inserts a character, and clamping against
   * that is what would pin the caret behind every keystroke.
   */
  const move = (next: number, limit = chars.length): void => {
    const clamped = Math.max(0, Math.min(limit, next));
    setCaret(clamped);
    const column = columnAt(clamped);
    if (column < start) setScroll(column);
    else if (column > start + field - 1) setScroll(column - field + 1);
  };

  useInput(
    (event: KeyEvent) => {
      if (disabled) return false;

      switch (event.name) {
        // Off either end is the caller's key, the same way it is in a
        // `TextArea`. Reported rather than passed on, because the field is
        // focused and a handler beside it would never see the event.
        case 'left':
          if (position === 0) { onEdge?.('start'); return true; }
          move(position - 1);
          return true;
        case 'right':
          if (position === chars.length) { onEdge?.('end'); return true; }
          move(position + 1);
          return true;
        case 'home': move(0); return true;
        case 'end': move(chars.length); return true;
        case 'backspace':
          if (position > 0) {
            onChange?.([...chars.slice(0, position - 1), ...chars.slice(position)].join(''));
            move(position - 1);
          }
          return true;
        case 'delete':
          if (position < chars.length) {
            onChange?.([...chars.slice(0, position), ...chars.slice(position + 1)].join(''));
          }
          return true;
        case 'enter':
          onSubmit?.(value);
          return true;
        case 'paste': {
          const text = event.char ?? '';
          const inserted = graphemes(text).length;
          const next = [...chars.slice(0, position), ...graphemes(text), ...chars.slice(position)].join('');
          onChange?.(maxLength ? next.slice(0, maxLength) : next);
          move(position + inserted, chars.length + inserted);
          return true;
        }
        default: break;
      }

      // A printable character. Modifiers mean it was a shortcut, not typing.
      if (event.char && !event.ctrl && !event.alt && !event.meta) {
        if (maxLength !== undefined && chars.length >= maxLength) return true;
        onChange?.([...chars.slice(0, position), event.char, ...chars.slice(position)].join(''));
        move(position + 1, chars.length + 1);
        return true;
      }
      return false;
    },
    { focusId: focus.id },
  );

  /**
   * A click takes the keyboard and puts the caret where it landed.
   *
   * Without it the field was the one control on the screen that did nothing
   * when it was clicked - and an empty one has nothing in it to say it is a
   * field, so what it looked like was a gap in the layout. `TextArea` has had
   * this from the start; the two disagreeing is what made a form built out of
   * the single-line one unusable with a mouse.
   *
   * `onMouse` rather than `onClick`, the same as there: a field that is not
   * focused has to take the keyboard before the caret moves, or the caret is
   * somewhere the next keystroke will not go.
   *
   * `measured` is the *content* rect - inside the border and the padding - so
   * the value starts at `lead` cells into it, and `start` is what the field
   * has scrolled past.
   */
  const onMouse = (event: MouseEvent): boolean => {
    if (disabled || event.button !== 'left' || event.action !== 'down') return false;
    if (measured.width <= 0) return false;
    if (event.x < measured.x || event.y < measured.y) return false;
    if (!focus.focused) focus.focus();

    // Cells to characters. A wide glyph is two columns, and a click on its
    // second column means the same character as a click on its first.
    const column = event.x - measured.x - lead + start;
    let index = 0;
    for (let width = 0; index < chars.length; index++) {
      const next = width + stringWidth(chars[index] as string);
      if (next > column) break;
      width = next;
    }
    move(index);
    return true;
  };

  return h('box', {
    id: focus.id,
    role: search ? 'searchbox' : 'textbox',
    onMouse,
    label,
    direction: 'row',
    gap: 1,
    border: { style: theme.border, color: focus.focused ? 'focus' : 'border' },
    padding: [0, 1],
    cursor: focus.focused ? lead + caretColumn - start : undefined,
    ...rest,
  },
    search ? h('text', { content: theme.glyphs.search, fg: 'muted' }) : null,
    inlineLabel ? h('text', { content: inlineLabel, fg: 'muted' }) : null,
    h('text', {
      content: empty
        ? sliceColumns(placeholder ?? '', 0, field)
        : sliceColumns(shown, start, field),
      fg: empty ? 'subtle' : disabled ? 'disabled' : undefined,
      flex: 1,
    }),
  );
});

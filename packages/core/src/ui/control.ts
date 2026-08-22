import type { ComponentDefinition } from '../types/component-registry.js';
import type { BoxProps } from '../jsx/intrinsics.js';
import type { KeyEvent } from '../types/input.js';
import type { BorderStyle, SemanticVariant, StyleColor, SurfaceVariant } from '../types/style.js';
import { h, defineComponent } from '../jsx/factory.js';
import { useFocus, useInput, useMeasure, useState, useTheme } from '../runtime/hooks.js';
import { graphemes, sliceColumns, stringWidth } from '../util/text.js';
import { ON_TONE, TONE } from './tone.js';

/**
 * Controls.
 *
 * Every control here is focusable, keyboard-first and states its own focus
 * ring, because a terminal has no hover to fall back on: if the focused
 * control is not obvious without moving a mouse, the interface is unusable.
 */

/** A border that takes up space without drawing anything. */
const BLANK_BORDER = {
  topLeft: ' ', top: ' ', topRight: ' ', right: ' ',
  bottomRight: ' ', bottom: ' ', bottomLeft: ' ', left: ' ',
  cross: ' ', teeTop: ' ', teeBottom: ' ', teeLeft: ' ', teeRight: ' ',
};

export interface ButtonProps extends BoxProps {
  label: string;
  tone?: SemanticVariant;
  variant?: SurfaceVariant;
  icon?: string;
  /** Shortcut hint rendered after the label. */
  hint?: string;
  onPress?(): void;
  autoFocus?: boolean;
}

export const Button = defineComponent<ButtonProps>('Button', (props) => {
  const theme = useTheme();
  const {
    label, tone = 'default', variant = 'outline', icon, hint,
    onPress, disabled, autoFocus, ...rest
  } = props;

  const focus = useFocus({ disabled, autoFocus });
  useInput(
    (event) => {
      if (disabled) return false;
      if (event.name === 'enter' || event.name === 'space') {
        onPress?.();
        return true;
      }
      return false;
    },
    { focusId: focus.id },
  );

  // Selection inverts.
  //
  // At rest a button is a line and a label in its tone; selected, the tone
  // becomes the background and the label flips to the colour written for it.
  // Recolouring only the border was too quiet to find - and next to a filled
  // button it read backwards, because the filled one looked like the selected
  // one however hard the border tried.
  const filled = (focus.focused || props.selected === true) && !disabled;
  const resolvedTone = filled && tone === 'default' ? 'primary' : tone;

  const color = disabled ? 'disabled' : TONE[resolvedTone];
  const onColor = disabled ? 'text' : ON_TONE[resolvedTone];

  // A solid button reserves the same ring an outline one draws, filled with
  // its own background rather than left out. Without it the two are one row
  // and three rows tall, and a dialog's OK sits a line above its Cancel.
  const solidBorder = {
    style: theme.border,
    color: focus.focused ? ('focus' as StyleColor) : undefined,
    ...(focus.focused ? {} : { chars: BLANK_BORDER }),
  };

  // The tone fills the inside of the frame, not the frame itself. A cell
  // carries one background, so a background on the button's own box lands on
  // the border glyphs too - rounded corners included - and the button reads as
  // a coloured block rather than a filled button. Hanging the fill on an inner
  // box leaves the ring on whatever is behind it. The wrapper is there whether
  // or not the button is filled, so focusing one does not reshape its tree.
  const inset = variant !== 'solid' && variant !== 'ghost' && variant !== 'link';

  // Filled, the frame becomes the fill's own edge.
  //
  // A cell holds one background, so filling the box the ordinary way colours
  // its border glyphs too and the button reads as a block; filling only the
  // inside leaves the border cell on the backdrop, and a gap runs between the
  // frame and the fill. `half` is drawn from block elements whose coloured
  // half faces inward, so the ring meets the inside with nothing between. It
  // measures the same as the line border it replaces - one cell a side - so
  // focus changes how a button looks without changing its size.
  //
  // A theme that asked for no border, or for ascii, is left alone: both are
  // deliberate looks, and `half` degrades to ascii anyway on a terminal that
  // cannot draw block elements.
  const filledBorder: BorderStyle =
    theme.border === 'none' || theme.border === 'ascii' ? theme.border : 'half';

  const style =
    variant === 'solid'
      ? { bg: color, fg: onColor, border: solidBorder }
      : variant === 'ghost' || variant === 'link'
        ? (filled ? { bg: color, fg: onColor } : { fg: color })
        : { border: { style: filled ? filledBorder : theme.border, color }, fg: color };

  const padding = variant === 'ghost' || variant === 'link' ? 0 : ([0, 1] as [number, number]);

  const content = [
    icon ? h('text', { content: icon }) : null,
    h('text', { content: label }),
    // On a filled button the hint has to sit on the tone too; `muted` against
    // a solid colour is the one combination that is never readable.
    hint ? h('text', { content: hint, fg: filled ? onColor : 'muted', dim: !filled }) : null,
  ];

  return h('box', {
    id: focus.id,
    role: 'button',
    label,
    direction: 'row',
    // The inner box owns the run of the label - gap, padding and centring -
    // whenever there is one, so the two paths measure the same.
    gap: inset ? 0 : 1,
    // Centred, so a button stretched by the row it sits in keeps its label on
    // the same line as its neighbours' labels.
    align: 'center',
    padding: inset ? 0 : padding,
    bold: inset ? undefined : focus.focused,
    underline: focus.focused && (variant === 'ghost' || variant === 'link'),
    onClick: () => { if (!disabled) onPress?.(); },
    ...style,
    ...rest,
  },
    inset
      ? h('box', {
          // Grow, so the fill reaches the frame on a button the row stretched.
          flex: 1,
          direction: 'row',
          gap: 1,
          align: 'center',
          padding,
          bold: focus.focused,
          ...(filled ? { bg: color, fg: onColor } : {}),
        }, ...content)
      : content,
  );
});

export interface CheckboxProps extends BoxProps {
  label?: string;
  checked?: boolean;
  /** Neither checked nor unchecked - a parent of mixed children. */
  indeterminate?: boolean;
  onChange?(checked: boolean): void;
}

export const Checkbox = defineComponent<CheckboxProps>('Checkbox', (props) => {
  const theme = useTheme();
  const { label, checked = false, indeterminate, onChange, disabled, ...rest } = props;
  const focus = useFocus({ disabled });

  useInput(
    (event) => {
      if (disabled) return false;
      if (event.name === 'space' || event.name === 'enter') {
        onChange?.(!checked);
        return true;
      }
      return false;
    },
    { focusId: focus.id },
  );

  const glyph = indeterminate
    ? theme.glyphs.checkboxMixed
    : checked ? theme.glyphs.checkboxOn : theme.glyphs.checkboxOff;

  return h('box', {
    id: focus.id,
    role: 'checkbox',
    label,
    selected: checked,
    direction: 'row',
    gap: 1,
    fg: disabled ? 'disabled' : focus.focused ? 'accent' : undefined,
    bold: focus.focused,
    onClick: () => { if (!disabled) onChange?.(!checked); },
    ...rest,
  },
    h('text', { content: glyph }),
    label ? h('text', { content: label }) : null,
  );
});

export interface SwitchProps extends BoxProps {
  label?: string;
  value?: boolean;
  onChange?(value: boolean): void;
  /** Words either side, so the state reads without colour. */
  labels?: [off: string, on: string];
}

export const Switch = defineComponent<SwitchProps>('Switch', (props) => {
  const { label, value = false, onChange, labels = ['off', 'on'], disabled, ...rest } = props;
  const focus = useFocus({ disabled });

  useInput(
    (event) => {
      if (disabled) return false;
      if (event.name === 'space' || event.name === 'enter') { onChange?.(!value); return true; }
      if (event.name === 'left') { onChange?.(false); return true; }
      if (event.name === 'right') { onChange?.(true); return true; }
      return false;
    },
    { focusId: focus.id },
  );

  return h('box', {
    id: focus.id, role: 'switch', label, selected: value,
    direction: 'row', gap: 1, bold: focus.focused,
    onClick: () => { if (!disabled) onChange?.(!value); },
    ...rest,
  },
    label ? h('text', { content: label }) : null,
    h('text', {
      content: value ? `[${labels[1]}]` : `[${labels[0]}]`,
      fg: disabled ? 'disabled' : value ? 'accent' : 'muted',
    }),
  );
});

export interface RadioOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface RadioGroupProps extends BoxProps {
  options: RadioOption[];
  value?: string;
  onChange?(value: string): void;
  label?: string;
  /** Lay the options out in a row instead of a column. */
  inline?: boolean;
}

export const RadioGroup = defineComponent<RadioGroupProps>('RadioGroup', (props) => {
  const theme = useTheme();
  const { options, value, onChange, label, inline, disabled, ...rest } = props;
  const focus = useFocus({ disabled });
  const index = Math.max(0, options.findIndex((o) => o.value === value));

  useInput(
    (event) => {
      if (disabled) return false;
      const step = inline
        ? (event.name === 'right' ? 1 : event.name === 'left' ? -1 : 0)
        : (event.name === 'down' ? 1 : event.name === 'up' ? -1 : 0);
      if (step === 0) return false;
      const next = options[(index + step + options.length) % options.length];
      if (next && !next.disabled) onChange?.(next.value);
      return true;
    },
    { focusId: focus.id },
  );

  return h('box', { id: focus.id, role: 'group', label, direction: 'column', gap: 0, ...rest },
    label ? h('text', { content: label, fg: 'muted' }) : null,
    h('box', { direction: inline ? 'row' : 'column', gap: inline ? 2 : 0 },
      ...options.map((option) => {
        const selected = option.value === value;
        return h('box', {
          key: option.value,
          direction: 'row',
          gap: 1,
          fg: option.disabled ? 'disabled' : selected && focus.focused ? 'accent' : undefined,
          bold: selected && focus.focused,
          onClick: () => { if (!option.disabled) onChange?.(option.value); },
        },
          h('text', { content: selected ? theme.glyphs.radioOn : theme.glyphs.radioOff }),
          h('text', { content: option.label }),
          option.description ? h('text', { content: option.description, fg: 'subtle' }) : null,
        );
      }),
    ),
  );
});

export interface SliderProps extends BoxProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  onChange?(value: number): void;
  /** Cells the track occupies. */
  trackWidth?: number;
  format?(value: number): string;
}

export const Slider = defineComponent<SliderProps>('Slider', (props) => {
  const theme = useTheme();
  const {
    value, min = 0, max = 100, step = 1, label, onChange,
    trackWidth = 20, format, disabled, ...rest
  } = props;
  const focus = useFocus({ disabled });

  const clamp = (v: number): number => Math.max(min, Math.min(max, v));

  useInput(
    (event) => {
      if (disabled) return false;
      const big = Math.max(step, Math.round((max - min) / 10));
      switch (event.name) {
        case 'left': onChange?.(clamp(value - step)); return true;
        case 'right': onChange?.(clamp(value + step)); return true;
        case 'pagedown': onChange?.(clamp(value - big)); return true;
        case 'pageup': onChange?.(clamp(value + big)); return true;
        case 'home': onChange?.(min); return true;
        case 'end': onChange?.(max); return true;
        default: return false;
      }
    },
    { focusId: focus.id },
  );

  const ratio = max === min ? 0 : (clamp(value) - min) / (max - min);
  const filled = Math.round(ratio * (trackWidth - 1));

  // Track, thumb and remainder all come from the theme, so an ascii terminal
  // gets `--o--` rather than a row of question marks.
  const thumb = theme.glyphs.bulletFilled;
  const done = theme.glyphs.progressFull;
  const todo = theme.glyphs.progressEmpty;
  const track = Array.from({ length: trackWidth }, (_, i) =>
    i === filled ? thumb : i < filled ? done : todo,
  ).join('');

  return h('box', { id: focus.id, role: 'slider', label, direction: 'row', gap: 1, ...rest },
    label ? h('text', { content: label, fg: 'muted' }) : null,
    h('text', {
      content: track,
      fg: disabled ? 'disabled' : focus.focused ? 'accent' : 'border',
    }),
    h('text', { content: format ? format(value) : String(value), fg: 'muted' }),
  );
});

export interface TextInputProps extends BoxProps {
  value: string;
  onChange?(value: string): void;
  onSubmit?(value: string): void;
  placeholder?: string;
  label?: string;
  /**
   * Keep the label as the field's name but do not draw it inside the field -
   * for a form or a dialog that already shows it beside or above the input.
   */
  hideLabel?: boolean;
  /** Replace every character, for secrets. */
  mask?: string;
  /** Stop accepting input past this many characters. */
  maxLength?: number;
  autoFocus?: boolean;
  /** Draw a search glyph before the field. */
  search?: boolean;
}

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
    value, onChange, onSubmit, placeholder, label, hideLabel, mask, maxLength,
    autoFocus, search, disabled, ...rest
  } = props;
  const inlineLabel = label && !search && !hideLabel ? label : undefined;

  const focus = useFocus({ disabled, autoFocus });
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
        case 'left': move(position - 1); return true;
        case 'right': move(position + 1); return true;
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

  return h('box', {
    id: focus.id,
    role: search ? 'searchbox' : 'textbox',
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

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  icon?: string;
}

export interface SelectProps extends BoxProps {
  options: SelectOption[];
  value?: string;
  onChange?(value: string): void;
  label?: string;
  placeholder?: string;
  /** Show the list inline instead of collapsing to one line. */
  open?: boolean;
  /** Rows shown at once when open. */
  visibleRows?: number;
}

export const Select = defineComponent<SelectProps>('Select', (props) => {
  const theme = useTheme();
  const {
    options, value, onChange, label, placeholder,
    open: openProp, visibleRows = 6, disabled, ...rest
  } = props;

  const focus = useFocus({ disabled });
  const empty = placeholder ?? `Select${theme.glyphs.ellipsis}`;
  const [open, setOpen] = useState(openProp ?? false);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const [highlight, setHighlight] = useState(index);

  useInput(
    (event) => {
      if (disabled) return false;
      if (!open) {
        if (event.name === 'enter' || event.name === 'space' || event.name === 'down') {
          setOpen(true);
          return true;
        }
        return false;
      }
      switch (event.name) {
        case 'up': setHighlight((highlight - 1 + options.length) % options.length); return true;
        case 'down': setHighlight((highlight + 1) % options.length); return true;
        case 'enter': {
          const chosen = options[highlight];
          if (chosen && !chosen.disabled) onChange?.(chosen.value);
          setOpen(false);
          return true;
        }
        case 'escape': setOpen(false); return true;
        default: return false;
      }
    },
    { focusId: focus.id },
  );

  const selected = options.find((o) => o.value === value);
  const start = Math.max(0, Math.min(highlight - Math.floor(visibleRows / 2), options.length - visibleRows));
  const window = options.slice(start, start + visibleRows);

  /**
   * One box, open or shut.
   *
   * The list used to be a second bordered box under the first, so opening the
   * control drew two rules back to back and the options read as a separate
   * thing that happened to be nearby. They are the control - the same border
   * holds both, with a rule between them where the two borders used to be.
   */
  return h('box', {
    id: focus.id,
    role: 'combobox',
    label,
    direction: 'column',
    border: { style: theme.border, color: focus.focused ? 'focus' : 'border' },
    padding: [0, 1],
    ...rest,
  },
    h('box', {
      direction: 'row',
      gap: 1,
      onClick: () => { if (!disabled) setOpen(!open); },
    },
      label ? h('text', { content: label, fg: 'muted' }) : null,
      h('text', {
        content: selected?.label ?? empty,
        fg: selected ? undefined : 'subtle',
        flex: 1,
        truncate: 'end',
      }),
      h('text', { content: open ? theme.glyphs.chevronUp : theme.glyphs.chevronDown, fg: 'muted' })),

    // A borderless theme has no rule to draw, and a blank row there would be
    // the gap this was meant to close.
    open && theme.border !== 'none'
      ? h('box', { height: 1, fill: theme.borderChars().top, fg: 'borderSubtle' })
      : null,

    open
      ? h('box', { direction: 'column' },
          ...window.map((option, i) => {
            const active = start + i === highlight;
            return h('box', {
              key: option.value,
              direction: 'row',
              gap: 1,
              // Ink, not a filled row.
              //
              // A background swatch is the heaviest mark available and it has
              // to invert the text to stay readable, so the highlighted option
              // is the one option whose colour tells you nothing about itself.
              // Accent and an underline say "here" without repainting the row.
              fg: option.disabled ? 'disabled' : active ? 'accent' : undefined,
              onClick: () => {
                if (option.disabled) return;
                onChange?.(option.value);
                setOpen(false);
              },
            },
              h('text', { content: active ? theme.glyphs.chevronRight : ' ' }),
              option.icon ? h('text', { content: option.icon }) : null,
              h('text', { content: option.label, underline: active, bold: active }),
              h('box', { flex: 1 }),
              option.value === value ? h('text', { content: theme.glyphs.check }) : null,
            );
          }))
      : null,
  );
});

export interface SearchBoxProps extends Omit<TextInputProps, 'search'> {
  /** Result count, shown after the field. */
  count?: number;
}

export const SearchBox = defineComponent<SearchBoxProps>('SearchBox', ({ count, ...props }) =>
  h('box', { direction: 'row', gap: 1 },
    h(TextInput, { search: true, flex: 1, ...props }),
    count !== undefined ? h('text', { content: `${count}`, fg: 'muted' }) : null,
  ),
);

export const CONTROL_COMPONENTS: ComponentDefinition[] = [
  { component: 'Button', category: 'control', renderer: { kind: 'function', render: Button }, role: 'button', variants: ['solid', 'outline', 'ghost', 'link'], description: 'Focusable action.' },
  { component: 'Checkbox', category: 'control', renderer: { kind: 'function', render: Checkbox }, role: 'checkbox', description: 'On, off, or mixed.' },
  { component: 'Switch', category: 'control', renderer: { kind: 'function', render: Switch }, role: 'switch', description: 'Two-state toggle with words, not only colour.' },
  { component: 'RadioGroup', category: 'control', renderer: { kind: 'function', render: RadioGroup }, role: 'radio', description: 'One of several.' },
  { component: 'Slider', category: 'control', renderer: { kind: 'function', render: Slider }, role: 'slider', description: 'A value along a track.' },
  { component: 'TextInput', category: 'control', renderer: { kind: 'function', render: TextInput }, role: 'textbox', description: 'Single-line text with a real caret.' },
  { component: 'Select', category: 'control', renderer: { kind: 'function', render: Select }, role: 'combobox', description: 'Pick from a list, collapsed or open.' },
  { component: 'SearchBox', category: 'control', renderer: { kind: 'function', render: SearchBox }, role: 'searchbox', description: 'A text field that looks like search.' },
];

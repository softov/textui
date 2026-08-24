import type { BoxProps } from '@textui/core';
import { defineComponent, h, useFocus, useInput, useState, useTheme } from '@textui/core';

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

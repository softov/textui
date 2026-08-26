import type { BoxProps } from '@textui/core';
import { defineComponent, h, useFocus, useInput, useTheme } from '@textui/core';

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
  /** Take the keyboard on arrival. */
  autoFocus?: boolean;
}

export const RadioGroup = defineComponent<RadioGroupProps>('RadioGroup', (props) => {
  const theme = useTheme();
  const { options, value, onChange, label, inline, disabled, autoFocus, ...rest } = props;
  const focus = useFocus({ disabled, autoFocus });
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

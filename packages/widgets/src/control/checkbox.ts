import type { BoxProps } from '@textui/core';
import { defineComponent, h, useFocus, useInput, useTheme } from '@textui/core';

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

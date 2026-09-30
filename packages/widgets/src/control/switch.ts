import type { BoxProps } from '@textui/core';
import { defineComponent, h, useFocus, useI18n, useInput } from '@textui/core';

export interface SwitchProps extends BoxProps {
  label?: string;
  value?: boolean;
  onChange?(value: boolean): void;
  /** Words either side, so the state reads without colour. */
  labels?: [off: string, on: string];
}

export const Switch = defineComponent<SwitchProps>('Switch', (props) => {
  const i18n = useI18n();
  const {
    label, value = false, onChange, disabled, ...rest
  } = props;
  const labels = props.labels ?? [
    i18n.t('textui.switch.off', undefined, 'off'),
    i18n.t('textui.switch.on', undefined, 'on'),
  ];
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

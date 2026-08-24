import type { BoxProps } from '@textui/core';
import { defineComponent, h, useTheme } from '@textui/core';

export interface DividerProps extends Omit<BoxProps, 'direction'> {
  /** A divider runs across the flow, so it names its own axis. */
  direction?: 'horizontal' | 'vertical';
  /** Text set into the rule. */
  label?: string;
  labelAlign?: 'left' | 'center' | 'right';
  char?: string;
}

export const Divider = defineComponent<DividerProps>('Divider', (props) => {
  const theme = useTheme();
  const { direction = 'horizontal', label, labelAlign = 'left', char, ...rest } = props;
  const chars = theme.borderChars();

  if (direction === 'vertical') {
    return h('box', { role: 'separator', width: 1, fill: char ?? chars.left, fg: 'border', ...rest });
  }

  if (!label) {
    return h('box', { role: 'separator', height: 1, fill: char ?? chars.top, fg: 'border', ...rest });
  }

  return h('box', { direction: 'row', gap: 1, height: 1, ...rest },
    labelAlign !== 'left' ? h('box', { flex: 1, fill: char ?? chars.top, fg: 'border' }) : null,
    h('text', { content: label, fg: 'muted' }),
    labelAlign !== 'right' ? h('box', { flex: 1, fill: char ?? chars.top, fg: 'border' }) : null,
  );
});

import type { BoxProps } from '@textui/core';
import { defineComponent, h, useTheme } from '@textui/core';

export interface TooltipProps extends BoxProps {
  text: string;
}

export const Tooltip = defineComponent<TooltipProps>('Tooltip', ({ text, ...rest }) => {
  const theme = useTheme();
  return h('box', {
    role: 'tooltip',
    border: theme.border,
    bg: 'overlay',
    padding: [0, 1],
    ...rest,
  }, h('text', { content: text }));
});

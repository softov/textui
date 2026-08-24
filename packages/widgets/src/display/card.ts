import type { BoxProps } from '@textui/core';
import { defineComponent, h, useTheme } from '@textui/core';

export interface CardProps extends BoxProps {
  title?: string;
  subtitle?: string;
  footer?: string;
}

export const Card = defineComponent<CardProps>('Card', (props) => {
  const theme = useTheme();
  const { title, subtitle, children, ...rest } = props;
  return h('box', {
    border: theme.border,
    padding: theme.density === 'compact' ? 0 : [0, 1],
    direction: 'column',
    title,
    ...rest,
  },
    subtitle ? h('text', { content: subtitle, fg: 'muted' }) : null,
    children,
  );
});

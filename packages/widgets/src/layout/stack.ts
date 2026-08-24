import type { BoxProps } from '@textui/core';
import { defineComponent, h, useTheme } from '@textui/core';

export interface StackProps extends BoxProps {
  /** Space between children, from the theme's scale. */
  spacing?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export const Stack = defineComponent<StackProps>('Stack', ({ spacing = 'sm', ...props }) => {
  const theme = useTheme();
  return h('box', { direction: 'column', gap: theme.spacing[spacing], ...props });
});

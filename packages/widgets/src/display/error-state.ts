import type { BoxProps } from '@textui/core';
import { defineComponent, h, useTheme } from '@textui/core';

export interface ErrorStateProps extends BoxProps {
  title?: string;
  error: unknown;
  /** Command id offered as a retry. */
  onRetry?: () => void;
}

export const ErrorState = defineComponent<ErrorStateProps>('ErrorState', (props) => {
  const theme = useTheme();
  const { title = 'Something went wrong', error, onRetry, ...rest } = props;
  const message = error instanceof Error ? error.message : String(error);

  return h('box', { role: 'alert', direction: 'column', gap: 1, padding: 1, ...rest },
    h('box', { direction: 'row', gap: 1 },
      h('text', { content: theme.glyphs.cross, fg: 'danger' }),
      h('text', { content: title, bold: true, fg: 'danger' })),
    h('text', { content: message, fg: 'muted', wrap: 'word' }),
    onRetry ? h('text', { content: 'r  retry', fg: 'subtle' }) : null,
  );
});

import type { BoxProps } from '@textui/core';
import { defineComponent, h } from '@textui/core';

export interface EmptyStateProps extends BoxProps {
  title: string;
  message?: string;
  icon?: string;
  /** Hint text: what the reader can do about it. */
  hint?: string;
}

export const EmptyState = defineComponent<EmptyStateProps>('EmptyState', (props) => {
  const { title, message, icon, hint, children, ...rest } = props;
  return h('box', { direction: 'column', align: 'center', justify: 'center', flex: 1, gap: 0, ...rest },
    icon ? h('text', { content: icon, fg: 'subtle' }) : null,
    h('text', { content: title, bold: true, fg: 'muted' }),
    message ? h('text', { content: message, fg: 'subtle', wrap: 'word', textAlign: 'center' }) : null,
    hint ? h('text', { content: hint, fg: 'subtle', dim: true }) : null,
    children,
  );
});

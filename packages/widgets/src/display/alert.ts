import type { BoxProps } from '@textui/core';
import { defineComponent, h, useTheme } from '@textui/core';

export interface AlertProps extends BoxProps {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  message?: string;
}

export const Alert = defineComponent<AlertProps>('Alert', (props) => {
  const theme = useTheme();
  const { tone = 'info', title, message, children, ...rest } = props;
  const icon = {
    info: theme.glyphs.info,
    success: theme.glyphs.check,
    warning: theme.glyphs.warning,
    danger: theme.glyphs.cross,
  }[tone];

  return h('box', { role: 'alert', direction: 'row', gap: 1, ...rest },
    h('text', { content: icon, fg: tone }),
    h('box', { direction: 'column', flex: 1 },
      title ? h('text', { content: title, bold: true, fg: tone }) : null,
      message ? h('text', { content: message, wrap: 'word' }) : null,
      children,
    ),
  );
});

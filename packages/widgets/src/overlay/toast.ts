import type { BoxProps, SemanticVariant } from '@textui/core';
import { defineComponent, h, useTheme } from '@textui/core';

export interface ToastProps extends BoxProps {
  message: string;
  tone?: SemanticVariant;
  title?: string;
  icon?: string;
}

export const Toast = defineComponent<ToastProps>('Toast', (props) => {
  const theme = useTheme();
  const { message, tone = 'info', title, icon, ...rest } = props;
  const glyph = icon ?? {
    success: theme.glyphs.check,
    warning: theme.glyphs.warning,
    danger: theme.glyphs.cross,
    info: theme.glyphs.info,
  }[tone as 'success' | 'warning' | 'danger' | 'info'] ?? theme.glyphs.info;

  return h('box', {
    role: 'status',
    border: theme.border,
    bg: 'overlay',
    padding: [0, 1],
    direction: 'row',
    gap: 1,
    ...rest,
  },
    h('text', { content: glyph, fg: tone }),
    h('box', { direction: 'column' },
      title ? h('text', { content: title, bold: true }) : null,
      h('text', { content: message, wrap: 'word' })),
  );
});

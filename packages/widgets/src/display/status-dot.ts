import type { BoxProps, StyleColor } from '@textui/core';
import { defineComponent, h, useTheme } from '@textui/core';

export interface StatusDotProps extends BoxProps {
  status: 'up' | 'down' | 'degraded' | 'unknown' | 'pending';
  label?: string;
}

/** The status vocabulary, so "degraded" looks the same everywhere. */
export const StatusDot = defineComponent<StatusDotProps>('StatusDot', ({ status, label, ...rest }) => {
  const theme = useTheme();
  const map = {
    up: { glyph: theme.glyphs.bulletFilled, fg: 'success' as StyleColor },
    degraded: { glyph: theme.glyphs.bulletHalf, fg: 'warning' as StyleColor },
    down: { glyph: theme.glyphs.bulletHollow, fg: 'danger' as StyleColor },
    pending: { glyph: theme.glyphs.bulletHollow, fg: 'info' as StyleColor },
    unknown: { glyph: theme.glyphs.separator, fg: 'muted' as StyleColor },
  }[status];

  return h('box', { role: 'status', label: label ?? status, direction: 'row', gap: 1, ...rest },
    h('text', { content: map.glyph, fg: map.fg }),
    label ? h('text', { content: label }) : null,
  );
});

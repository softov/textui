import type { BoxProps, SemanticVariant } from '@textui/core';
import { defineComponent, h, useTheme } from '@textui/core';
import { TONE as TONE_COLOR } from '../tone.js';

export interface TimelineProps extends BoxProps {
  items: {
    time?: string;
    title: string;
    description?: string;
    tone?: SemanticVariant;
    icon?: string;
  }[];
}

export const Timeline = defineComponent<TimelineProps>('Timeline', ({ items, ...rest }) => {
  const theme = useTheme();
  return h('box', { direction: 'column', ...rest },
    ...items.map((item, i) =>
      h('box', { key: i, direction: 'row', gap: 1 },
        h('box', { direction: 'column', width: 1 },
          h('text', { content: item.icon ?? theme.glyphs.bulletFilled, fg: item.tone ? TONE_COLOR[item.tone] : 'accent' }),
          i < items.length - 1 ? h('text', { content: theme.borderChars().left, fg: 'borderSubtle' }) : null),
        h('box', { direction: 'column', flex: 1 },
          h('box', { direction: 'row', gap: 1 },
            h('text', { content: item.title, bold: true }),
            item.time ? h('spacer', { flex: 1 }) : null,
            item.time ? h('text', { content: item.time, fg: 'muted' }) : null),
          item.description ? h('text', { content: item.description, fg: 'muted', wrap: 'word' }) : null),
      ),
    ),
  );
});

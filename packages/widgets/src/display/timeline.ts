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
        // The gutter is as tall as the entry beside it, not two rows.
        //
        // The connector used to be a single `text`, so an entry whose
        // description wrapped - or which had a description at all, in a narrow
        // column - got one cell of line under its bullet and then a gap, and
        // the thread that makes a timeline a timeline broke at every long
        // entry. `fill` paints the glyph into every cell it is given and
        // `flex` gives it whatever the row turned out to be.
        h('box', { direction: 'column', width: 1, alignSelf: 'stretch' },
          h('text', { content: item.icon ?? theme.glyphs.bulletFilled, fg: item.tone ? TONE_COLOR[item.tone] : 'accent' }),
          i < items.length - 1
            // `minHeight` as well as `flex`: an entry with nothing but a
            // title is one row tall, so a purely elastic connector would get
            // no rows at all and two short entries would sit against each
            // other with no thread between them. One row is the floor, and
            // what a short entry has always had.
            ? h('box', { flex: 1, minHeight: 1, fill: theme.borderChars().left, fg: 'borderSubtle' })
            : null),
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

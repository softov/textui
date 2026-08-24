import type { BoxProps, SemanticVariant } from '@textui/core';
import { defineComponent, h, useTheme } from '@textui/core';
import { TONE } from '../tone.js';

export interface StatusSegment {
  id: string;
  label: string;
  icon?: string;
  tone?: SemanticVariant;
}

export interface StatusBarProps extends BoxProps {
  /**
   * Segments before the gap and after it. Named `leading`/`trailing` rather
   * than `left`/`right` because those are style props on every node.
   */
  leading?: StatusSegment[];
  trailing?: StatusSegment[];
  separator?: string;
}

export const StatusBar = defineComponent<StatusBarProps>('StatusBar', (props) => {
  const theme = useTheme();
  const { leading = [], trailing = [], separator, ...rest } = props;
  const sep = separator ?? ` ${theme.glyphs.separator} `;

  const segment = (item: StatusSegment): unknown =>
    h('box', { key: item.id, direction: 'row', gap: item.icon ? 1 : 0 },
      item.icon ? h('text', { content: item.icon, fg: item.tone ? TONE[item.tone] : undefined }) : null,
      h('text', { content: item.label, fg: item.tone ? TONE[item.tone] : 'muted' }));

  const join = (items: StatusSegment[]): unknown[] =>
    items.flatMap((item, i) =>
      i === items.length - 1
        ? [segment(item)]
        : [segment(item), h('text', { key: `${item.id}-s`, content: sep, fg: 'subtle' })]);

  return h('box', { role: 'contentinfo', direction: 'row', height: 1, ...rest },
    ...join(leading),
    h('spacer', { flex: 1 }),
    ...join(trailing),
  );
});

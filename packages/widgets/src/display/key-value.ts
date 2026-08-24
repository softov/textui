import type { BoxProps, SemanticVariant } from '@textui/core';
import { defineComponent, h, stringWidth } from '@textui/core';
import { TONE as TONE_COLOR } from '../tone.js';

export interface KeyValueProps extends BoxProps {
  items: { label: string; value: string; tone?: SemanticVariant }[];
  /** Cells reserved for labels. Computed from the longest when unset. */
  labelWidth?: number;
  columns?: number;
}

/** Structured data as aligned label/value pairs. */
export const KeyValue = defineComponent<KeyValueProps>('KeyValue', (props) => {
  const { items, labelWidth, columns = 1, ...rest } = props;
  const width = labelWidth ?? Math.max(0, ...items.map((i) => stringWidth(i.label)));

  const rows: typeof items[] = [];
  for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns));

  return h('box', { direction: 'column', ...rest },
    ...rows.map((row, i) =>
      h('box', { key: i, direction: 'row', gap: 2 },
        ...row.map((item, j) =>
          h('box', { key: j, direction: 'row', gap: 1, flex: 1 },
            h('box', { width }, h('text', { content: item.label, fg: 'muted' })),
            h('text', { content: item.value, fg: item.tone ? TONE_COLOR[item.tone] : undefined, truncate: 'end', flex: 1 }),
          ),
        ),
      ),
    ),
  );
});

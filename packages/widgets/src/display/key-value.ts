import type { BoxProps, SemanticVariant } from '@textui/core';
import { defineComponent, h, stringWidth } from '@textui/core';
import { TONE as TONE_COLOR } from '../tone.js';

/** Where a label or a value sits in the cells it was given. */
export type KeyValueAlign = 'left' | 'right';

export interface KeyValueItem {
  label: string;
  value: string;
  tone?: SemanticVariant;
  /** Overrides the block's `labelAlign` for this pair. */
  labelAlign?: KeyValueAlign;
  /** Overrides the block's `valueAlign` for this pair. */
  valueAlign?: KeyValueAlign;
}

export interface KeyValueProps extends BoxProps {
  items: KeyValueItem[];
  /** Cells reserved for labels. Computed from the longest when unset. */
  labelWidth?: number;
  /**
   * Cells added to the longest label when the width is computed.
   *
   * The column is otherwise exactly as wide as its longest label, which leaves
   * the value one gap after it; room here is what makes the values read as a
   * column of their own rather than as the tail of the labels. Ignored when
   * `labelWidth` states the width, which is exact.
   */
  labelGap?: number;
  /** Where a label sits in its column. `left` by default. */
  labelAlign?: KeyValueAlign;
  /** Where a value sits in what is left of the pair. `left` by default. */
  valueAlign?: KeyValueAlign;
  columns?: number;
}

/** Structured data as aligned label/value pairs. */
export const KeyValue = defineComponent<KeyValueProps>('KeyValue', (props) => {
  const {
    items, labelWidth, labelGap = 0, labelAlign = 'left', valueAlign = 'left', columns = 1, ...rest
  } = props;
  const width = labelWidth ?? Math.max(0, ...items.map((i) => stringWidth(i.label))) + labelGap;

  const rows: KeyValueItem[][] = [];
  for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns));

  return h('box', { direction: 'column', ...rest },
    ...rows.map((row, i) =>
      h('box', { key: i, direction: 'row', gap: 2 },
        ...row.map((item, j) =>
          h('box', { key: j, direction: 'row', gap: 1, flex: 1 },
            h('box', { width }, h('text', {
              content: item.label,
              fg: 'muted',
              textAlign: item.labelAlign ?? labelAlign,
            })),
            h('text', {
              content: item.value,
              fg: item.tone ? TONE_COLOR[item.tone] : undefined,
              truncate: 'end',
              flex: 1,
              textAlign: item.valueAlign ?? valueAlign,
            }),
          ),
        ),
      ),
    ),
  );
});

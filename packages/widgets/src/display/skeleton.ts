import type { BoxProps } from '@textui/core';
import { defineComponent, h } from '@textui/core';

export interface SkeletonProps extends BoxProps {
  lines?: number;
  /** Width of each line, in cells or as a fraction of the box. */
  widths?: number[];
}

export const Skeleton = defineComponent<SkeletonProps>('Skeleton', ({ lines = 3, widths, ...rest }) =>
  h('box', { direction: 'column', gap: 0, ...rest },
    ...Array.from({ length: lines }, (_, i) =>
      h('box', {
        key: i,
        height: 1,
        width: widths?.[i] ?? (i === lines - 1 ? '60%' : '100%'),
        fill: '░',
        fg: 'borderSubtle',
      }),
    ),
  ),
);

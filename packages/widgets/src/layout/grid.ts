import type { BoxProps } from '@textui/core';
import { defineComponent, h } from '@textui/core';

export interface GridProps extends BoxProps {
  columns: number;
}

/**
 * A grid is rows of equal-flex cells. Terminals have no sub-cell measurement,
 * so an even split is the honest primitive; anything else is a Row with widths.
 */
export const Grid = defineComponent<GridProps>('Grid', ({ columns, columnGap, rowGap, children, ...props }) => {
  const items = Array.isArray(children) ? children : children === undefined ? [] : [children];
  const rows: unknown[][] = [];
  for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns));

  return h('box', { direction: 'column', gap: rowGap ?? props.gap ?? 0, ...props },
    ...rows.map((row, i) =>
      h('box', { key: i, direction: 'row', gap: columnGap ?? props.gap ?? 1 },
        // `basis: 0` is what makes the columns *equal* rather than merely
        // flexible. Without it a cell starts at the width its content asked
        // for and only the space left over is shared - so a pane holding one
        // long unwrapped line takes two thirds of the row and the one beside
        // it is squeezed to a column of single words. Equal columns is what
        // this component says it is for; anything that wants to be sized by
        // its content wants a `Row`.
        ...row.map((cell, j) => h('box', { key: j, flex: 1, basis: 0, minWidth: 0 }, cell)),
        // Pad the last row so its cells keep the same width as the others.
        ...Array.from({ length: columns - row.length }, (_, k) =>
          h('box', { key: `pad${k}`, flex: 1, basis: 0 })),
      ),
    ),
  );
});

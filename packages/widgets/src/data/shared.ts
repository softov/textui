import type { BoxProps } from '@textui/core';
import { defineComponent, h, useEffect, useMeasure } from '@textui/core';

/**
 * An entry that reports how tall it turned out to be.
 *
 * Through a ref rather than state, deliberately: a height arriving must not
 * schedule a render, or every measurement would cause the next measurement.
 *
 * It reports its `index` to one shared handler rather than taking a closure
 * that already knows it. A closure per entry is a new prop on every entry
 * every time the feed itself re-renders, and a changed prop is a re-render -
 * so a feed that redrew for its own reasons dragged every entry it holds
 * along with it, however little any of them had changed.
 */
export const FeedEntry = defineComponent<BoxProps & {
  index: number;
  onHeight(index: number, height: number): void;
}>(
  'FeedEntry',
  (props) => {
    const { index, onHeight, children, ...rest } = props;
    const measured = useMeasure();
    useEffect(() => {
      onHeight(index, measured.height);
    }, [measured.height]);
    return h('box', { direction: 'column', ...rest }, children);
  },
);

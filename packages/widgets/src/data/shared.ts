import type { BoxProps } from '@textui/core';
import { defineComponent, h, useEffect, useMeasure, useTheme } from '@textui/core';

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
  /**
   * Standing in for an entry that is not drawn, at the height it had.
   *
   * A stand-in must not answer the question it is an answer to. Its height is
   * one the feed already knows - it is where it came from - and reporting it
   * back is how a measurement gets to depend on itself: a round where a
   * stand-in came out any shorter would teach the feed that it *was* shorter,
   * and the next round would place the rest of them on top of each other.
   */
  placeholder?: boolean;
  onHeight(index: number, height: number): void;
}>(
  'FeedEntry',
  (props) => {
    const { index, placeholder, onHeight, children, ...rest } = props;
    const measured = useMeasure();
    useEffect(() => {
      if (placeholder) return;
      onHeight(index, measured.height);
    }, [measured.height, placeholder]);
    return h('box', { direction: 'column', ...rest }, children);
  },
);

export const FeedScrollbar = defineComponent<Record<string, never>>('FeedScrollbar', () => {
  const theme = useTheme();
  return h('box', { width: 1, fill: theme.borderChars().left, fg: 'borderSubtle' });
});

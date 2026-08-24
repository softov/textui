import type { BoxProps } from '@textui/core';
import { defineComponent, h, useEffect, useMeasure, useTheme } from '@textui/core';

/**
 * An entry that reports how tall it turned out to be.
 *
 * Through a ref rather than state, deliberately: a height arriving must not
 * schedule a render, or every measurement would cause the next measurement.
 */
export const FeedEntry = defineComponent<BoxProps & { onHeight(height: number): void }>(
  'FeedEntry',
  (props) => {
    const { onHeight, children, ...rest } = props;
    const measured = useMeasure();
    useEffect(() => { onHeight(measured.height); }, [measured.height]);
    return h('box', { direction: 'column', ...rest }, children);
  },
);

export const FeedScrollbar = defineComponent<Record<string, never>>('FeedScrollbar', () => {
  const theme = useTheme();
  return h('box', { width: 1, fill: theme.borderChars().left, fg: 'borderSubtle' });
});

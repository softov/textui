import type { BoxProps, SemanticVariant } from '@textui/core';
import { defineComponent, h } from '@textui/core';
import { VerticalBars, bounds } from './shared.js';

export interface HistogramProps extends BoxProps {
  values: number[];
  /** Number of buckets. */
  buckets?: number;
  min?: number;
  max?: number;
  tone?: SemanticVariant;
  chartHeight?: number;
}

export const Histogram = defineComponent<HistogramProps>('Histogram', (props) => {
  const { values, buckets = 12, min, max, tone = 'accent', chartHeight = 6, ...rest } = props;
  const [lo, hi] = bounds(values, min, max);

  const counts = new Array<number>(buckets).fill(0);
  for (const value of values) {
    const ratio = (value - lo) / (hi - lo);
    const index = Math.max(0, Math.min(buckets - 1, Math.floor(ratio * buckets)));
    counts[index] = (counts[index] as number) + 1;
  }

  return h(VerticalBars, {
    data: counts.map((count, i) => ({
      label: String(Math.round(lo + ((hi - lo) * i) / buckets)),
      value: count,
      tone,
    })),
    max: Math.max(1, ...counts),
    height: chartHeight,
    ...rest,
  });
});

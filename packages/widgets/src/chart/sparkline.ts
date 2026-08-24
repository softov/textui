import type { BoxProps, SemanticVariant } from '@textui/core';
import { defineComponent, h, useTheme } from '@textui/core';
import { TONE, bounds, resample } from './shared.js';

export interface SparklineProps extends BoxProps {
  values: number[];
  min?: number;
  max?: number;
  tone?: SemanticVariant;
  /** Cells wide. Values are sampled to fit. */
  chartWidth?: number;
  /** Print the latest value after the line. */
  showValue?: boolean;
  format?(value: number): string;
}

/** One row of block glyphs: eight levels per cell. */
export const Sparkline = defineComponent<SparklineProps>('Sparkline', (props) => {
  const theme = useTheme();
  const {
    values, min, max, tone = 'accent', chartWidth,
    showValue = false, format, ...rest
  } = props;

  const blocks = theme.glyphs.blocks;
  const width = chartWidth ?? values.length;
  const sampled = resample(values, width);
  const [lo, hi] = bounds(sampled, min, max);

  const line = sampled
    .map((v) => {
      const ratio = (v - lo) / (hi - lo);
      const index = Math.max(0, Math.min(blocks.length - 1, Math.round(ratio * (blocks.length - 1))));
      return blocks[index] as string;
    })
    .join('');

  const latest = values[values.length - 1];

  return h('box', { direction: 'row', gap: 1, ...rest },
    h('text', { content: line, fg: TONE[tone] }),
    showValue && latest !== undefined
      ? h('text', { content: format ? format(latest) : String(latest), fg: 'muted' })
      : null,
  );
});

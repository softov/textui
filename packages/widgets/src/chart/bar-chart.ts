import type { BoxProps, SemanticVariant } from '@textui/core';
import { defineComponent, h, stringWidth, useTheme } from '@textui/core';
import { TONE, VerticalBars } from './shared.js';

export interface BarChartProps extends BoxProps {
  data: { label: string; value: number; tone?: SemanticVariant }[];
  max?: number;
  /** Cells the bars occupy, not counting labels. */
  barWidth?: number;
  showValue?: boolean;
  format?(value: number): string;
  orientation?: 'horizontal' | 'vertical';
}

export const BarChart = defineComponent<BarChartProps>('BarChart', (props) => {
  const theme = useTheme();
  const {
    data, max, barWidth = 20, showValue = true, format,
    orientation = 'horizontal', ...rest
  } = props;

  const hi = max ?? Math.max(1, ...data.map((d) => d.value));
  const labelWidth = Math.max(0, ...data.map((d) => stringWidth(d.label)));

  if (orientation === 'vertical') {
    return h(VerticalBars, { data, max: hi, height: 8, ...rest });
  }

  const partials = theme.glyphs.progressPartial;

  return h('box', { direction: 'column', ...rest },
    ...data.map((item) => {
      const exact = (item.value / hi) * barWidth;
      const full = Math.floor(exact);
      const rem = exact - full;
      const partial = full < barWidth && rem > 0
        ? (partials[Math.floor(rem * partials.length)] ?? '')
        : '';

      return h('box', { key: item.label, direction: 'row', gap: 1 },
        h('box', { width: labelWidth }, h('text', { content: item.label, fg: 'muted' })),
        h('text', {
          content: theme.glyphs.progressFull.repeat(full) + partial,
          fg: TONE[item.tone ?? 'accent'],
        }),
        showValue
          ? h('text', { content: format ? format(item.value) : String(item.value), fg: 'muted' })
          : null,
      );
    }),
  );
});

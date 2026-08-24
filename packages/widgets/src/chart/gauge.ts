import type { BoxProps, SemanticVariant } from '@textui/core';
import { defineComponent, h, useTheme } from '@textui/core';
import { TONE } from './shared.js';

export interface GaugeProps extends BoxProps {
  value: number;
  min?: number;
  max?: number;
  label?: string;
  /** Bands that colour the reading by range. */
  thresholds?: { at: number; tone: SemanticVariant }[];
  format?(value: number): string;
  gaugeWidth?: number;
}

export const Gauge = defineComponent<GaugeProps>('Gauge', (props) => {
  const theme = useTheme();
  const {
    value, min = 0, max = 100, label, thresholds = [], format, gaugeWidth = 20, ...rest
  } = props;

  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));
  const filled = Math.round(ratio * gaugeWidth);

  // The highest threshold at or below the value wins.
  const tone = [...thresholds]
    .sort((a, b) => b.at - a.at)
    .find((t) => value >= t.at)?.tone ?? 'accent';

  return h('box', { direction: 'row', gap: 1, role: 'meter', label, ...rest },
    label ? h('text', { content: label, fg: 'muted' }) : null,
    h('text', {
      content:
        theme.glyphs.progressFull.repeat(filled) +
        theme.glyphs.progressEmpty.repeat(Math.max(0, gaugeWidth - filled)),
      fg: TONE[tone],
    }),
    h('text', {
      content: format ? format(value) : `${Math.round(ratio * 100)}%`,
      fg: TONE[tone],
      bold: true,
    }),
  );
});

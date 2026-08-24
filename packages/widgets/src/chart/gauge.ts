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
  /**
   * Push the gauge away from the label, to the right edge of the row.
   *
   * The label's cell stretches, so it stays at the left and
   * the track ends up hard against the right - which is what makes a column of
   * these read as a table rather than as a ragged stack. Needs a row wider
   * than its contents to have any effect, so the caller has to have given it a
   * width or a `flex`.
   */
  spacer?: boolean;
}

export const Gauge = defineComponent<GaugeProps>('Gauge', (props) => {
  const theme = useTheme();
  const {
    value, min = 0, max = 100, label, thresholds = [], format, gaugeWidth = 20,
    spacer, ...rest
  } = props;

  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));
  const filled = Math.round(ratio * gaugeWidth);

  // The highest threshold at or below the value wins.
  const tone = [...thresholds]
    .sort((a, b) => b.at - a.at)
    .find((t) => value >= t.at)?.tone ?? 'accent';

  return h('box', { direction: 'row', gap: 1, role: 'meter', label, ...rest },
    label !== undefined
      // The label's own cell stretches rather than a `spacer` child going in
      // beside it: a child would be free but its gap would not, and a row
      // sized exactly to its contents would truncate the gauge to fit a space.
      ? h('text', { content: label, fg: 'muted', ...(spacer === true ? { flex: 1 } : {}) })
      : spacer === true ? h('spacer', {}) : null,
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

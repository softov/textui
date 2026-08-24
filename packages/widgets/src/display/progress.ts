import type { BoxProps, SemanticVariant } from '@textui/core';
import { defineComponent, h, useFrame, useTheme } from '@textui/core';
import { TONE as TONE_COLOR } from '../tone.js';

export interface ProgressProps extends BoxProps {
  /** 0..1. Omit for an indeterminate bar. */
  value?: number;
  total?: number;
  label?: string;
  /** Show the percentage after the bar. */
  showValue?: boolean;
  tone?: SemanticVariant;
  barWidth?: number;
  /**
   * A fixed gutter for the label, so a stack of bars starts at one column.
   *
   * Labels are their own width otherwise, which is right for one bar and
   * wrong for three: "download", "index" and "working" each push their track
   * to a different place and the group reads as three unrelated widgets.
   * Nothing here can measure its siblings, so whoever stacks them says.
   */
  labelWidth?: number;
}

/**
 * A progress bar with sub-cell resolution: the partial block glyphs give eight
 * steps per cell, so a 20-cell bar moves smoothly rather than in 5% jumps.
 */
export const Progress = defineComponent<ProgressProps>('Progress', (props) => {
  const theme = useTheme();
  const {
    value, total = 1, label, showValue = true, tone = 'primary', barWidth, labelWidth, ...rest
  } = props;
  const frame = useFrame(8);

  const width = barWidth ?? 20;
  const ratio = value === undefined ? 0 : Math.max(0, Math.min(1, value / total));

  let bar: string;
  if (value === undefined) {
    // Indeterminate: a block that travels the track.
    const pos = frame % Math.max(1, width);
    bar = Array.from({ length: width }, (_, i) =>
      Math.abs(i - pos) < 2 ? theme.glyphs.progressFull : theme.glyphs.progressEmpty,
    ).join('');
  } else {
    const exact = ratio * width;
    const full = Math.floor(exact);
    const partials = theme.glyphs.progressPartial;
    const remainder = exact - full;
    const partialIndex = Math.floor(remainder * partials.length);
    const partial = full < width && remainder > 0 ? (partials[partialIndex] ?? '') : '';
    bar =
      theme.glyphs.progressFull.repeat(full) +
      partial +
      theme.glyphs.progressEmpty.repeat(Math.max(0, width - full - (partial ? 1 : 0)));
  }

  return h('box', { role: 'progressbar', label, direction: 'row', gap: 1, ...rest },
    label
      ? h('text', {
          content: label,
          fg: 'muted',
          ...(labelWidth === undefined ? {} : { width: labelWidth, truncate: 'end' as const }),
        })
      : null,
    h('text', { content: bar, fg: TONE_COLOR[tone] }),
    showValue && value !== undefined
      ? h('text', { content: `${Math.round(ratio * 100)}%`, fg: 'muted' })
      : null,
  );
});

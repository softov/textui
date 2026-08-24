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
  /**
   * Push the bar away from the label, to the right edge of the row.
   *
   * The label's cell stretches, so it stays at the left and
   * the track ends up hard against the right - which is what makes a column of
   * these read as a table rather than as a ragged stack.
   *
   * Different from `labelWidth`, which pads the *label* to a fixed gutter: use
   * that when the bars should start at one column, and this when they should
   * end at one. Needs a row wider than its contents to have any effect, so the
   * caller has to have given it a width or a `flex`.
   */
  spacer?: boolean;
}

/**
 * A progress bar with sub-cell resolution: the partial block glyphs give eight
 * steps per cell, so a 20-cell bar moves smoothly rather than in 5% jumps.
 */
export const Progress = defineComponent<ProgressProps>('Progress', (props) => {
  const theme = useTheme();
  const {
    value, total = 1, label, showValue = true, tone = 'primary', barWidth, labelWidth,
    spacer, ...rest
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
    label !== undefined
      ? h('text', {
          content: label,
          fg: 'muted',
          ...(labelWidth === undefined ? {} : { width: labelWidth, truncate: 'end' as const }),
          // The label's own cell stretches, rather than a `spacer` child going
          // in beside it. A child would be free but its *gap* would not: with
          // `gap: 1` on the row, one more child is one more cell, so a row
          // sized exactly to its contents would truncate the bar to make room
          // for a space. Stretching what is already there costs nothing.
          ...(spacer === true ? { flex: 1 } : {}),
        })
      : spacer === true ? h('spacer', {}) : null,
    h('text', { content: bar, fg: TONE_COLOR[tone] }),
    showValue && value !== undefined
      ? h('text', { content: `${Math.round(ratio * 100)}%`, fg: 'muted' })
      : null,
  );
});

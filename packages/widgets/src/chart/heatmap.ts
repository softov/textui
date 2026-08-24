import type { BoxProps } from '@textui/core';
import { defineComponent, h, stringWidth, useTheme } from '@textui/core';
import { bounds } from './shared.js';

export interface HeatmapProps extends BoxProps {
  /** Rows of values. All rows should be the same length. */
  data: number[][];
  min?: number;
  max?: number;
  rowLabels?: string[];
  columnLabels?: string[];
  /** Glyph ramp, lowest to highest. Defaults to the theme's blocks. */
  ramp?: readonly string[];
}

export const Heatmap = defineComponent<HeatmapProps>('Heatmap', (props) => {
  const theme = useTheme();
  const { data, min, max, rowLabels, columnLabels, ramp, ...rest } = props;
  const glyphs = ramp ?? theme.glyphs.blocks;
  const flat = data.flat();
  const [lo, hi] = bounds(flat, min, max);
  const labelWidth = rowLabels ? Math.max(0, ...rowLabels.map(stringWidth)) : 0;

  return h('box', { direction: 'column', ...rest },
    columnLabels
      ? h('box', { direction: 'row', gap: 0 },
          labelWidth ? h('box', { width: labelWidth + 1 }) : null,
          h('text', {
            content: columnLabels.map((l) => l.slice(0, 1)).join(''),
            fg: 'subtle',
          }))
      : null,
    ...data.map((row, y) =>
      h('box', { key: y, direction: 'row', gap: rowLabels ? 1 : 0 },
        rowLabels
          ? h('box', { width: labelWidth }, h('text', { content: rowLabels[y] ?? '', fg: 'muted' }))
          : null,
        h('text', {
          content: row
            .map((v) => {
              const ratio = (v - lo) / (hi - lo);
              const index = Math.max(0, Math.min(glyphs.length - 1, Math.round(ratio * (glyphs.length - 1))));
              return glyphs[index] as string;
            })
            .join(''),
          fg: 'accent',
        }))),
  );
});

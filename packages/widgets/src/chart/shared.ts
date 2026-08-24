import type { BoxProps, SemanticVariant, StyleColor } from '@textui/core';
import { defineComponent, h, useTheme } from '@textui/core';

export const TONE: Record<SemanticVariant, StyleColor> = {
  default: 'text', primary: 'primary', secondary: 'secondary', accent: 'accent',
  success: 'success', warning: 'warning', danger: 'danger', info: 'info', muted: 'muted',
};

export interface Series {
  values: number[];
  label?: string;
  tone?: SemanticVariant;
}

export function bounds(values: number[], min?: number, max?: number): [number, number] {
  if (values.length === 0) return [min ?? 0, max ?? 1];
  const lo = min ?? Math.min(...values);
  const hi = max ?? Math.max(...values);
  return lo === hi ? [lo, lo + 1] : [lo, hi];
}

/** Take `width` samples, averaging when there is more data than cells. */
export function resample(values: number[], width: number): number[] {
  if (width <= 0) return [];
  if (values.length === 0) return new Array<number>(width).fill(0);
  if (values.length === width) return values;

  if (values.length < width) {
    // Fewer points than cells: stretch across the width. Padding with the
    // first value would invent a flat stretch of history that never happened,
    // which on a chart reads as "nothing was going on" rather than "no data".
    return Array.from({ length: width }, (_, i) => {
      const position = (i * (values.length - 1)) / (width - 1 || 1);
      const low = Math.floor(position);
      const high = Math.min(values.length - 1, low + 1);
      const t = position - low;
      return (values[low] as number) * (1 - t) + (values[high] as number) * t;
    });
  }

  const out: number[] = [];
  const bucket = values.length / width;
  for (let i = 0; i < width; i++) {
    const start = Math.floor(i * bucket);
    const end = Math.max(start + 1, Math.floor((i + 1) * bucket));
    const slice = values.slice(start, end);
    out.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }
  return out;
}

export const VerticalBars = defineComponent<{
  data: { label: string; value: number; tone?: SemanticVariant }[];
  max: number;
  height: number;
  /** Cells across, per bar. One is a hairline; two or three read as bars. */
  columnWidth?: number;
}>('VerticalBars', ({ data, max, height, columnWidth = 1, ...rest }) => {
  const theme = useTheme();
  const blocks = theme.glyphs.blocks;

  // Each cell holds eight levels, so a column is a run of full blocks plus one
  // partial - the same trick as the progress bar, turned on its side.
  const columns = data.map((item) => {
    const units = Math.round((item.value / max) * height * blocks.length);
    const full = Math.floor(units / blocks.length);
    const partialIndex = units % blocks.length;
    const cells: string[] = [];
    for (let row = height - 1; row >= 0; row--) {
      if (row < full) cells.push(blocks[blocks.length - 1] as string);
      else if (row === full && partialIndex > 0) cells.push(blocks[partialIndex - 1] as string);
      else cells.push(' ');
    }
    return { cells: cells.reverse(), item };
  });

  return h('box', { direction: 'column', ...rest },
    ...Array.from({ length: height }, (_, row) =>
      h('box', { key: row, direction: 'row', gap: 1 },
        ...columns.map((col, i) =>
          h('text', {
            key: i,
            // The glyph repeated, not a wider glyph: a column is one cell of
            // vertical resolution and `columnWidth` of horizontal, so widening
            // it must not change how the value is drawn.
            content: (col.cells[height - 1 - row] as string).repeat(columnWidth),
            fg: TONE[col.item.tone ?? 'accent'],
          })))),
    h('box', { direction: 'row', gap: 1 },
      ...data.map((item, i) =>
        // As much of the label as the bar is wide, padded so the next one
        // starts over its own bar rather than sliding left under a short name.
        h('text', {
          key: i,
          content: item.label.slice(0, columnWidth).padEnd(columnWidth),
          fg: 'subtle',
        }))),
  );
});

export interface LineChartProps extends BoxProps {
  series: Series[];
  min?: number;
  max?: number;
  chartWidth?: number;
  chartHeight?: number;
  /** Draw a y-axis with the bounds labelled. */
  axis?: boolean;
  /** Fill under the line. */
  area?: boolean;
  format?(value: number): string;
}

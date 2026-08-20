import type { ComponentDefinition } from '../types/component-registry.js';
import type { BoxProps } from '../jsx/intrinsics.js';
import type { PaintSurface, RenderContext } from '../types/render.js';
import type { SemanticVariant, StyleColor } from '../types/style.js';
import { h, defineComponent } from '../jsx/factory.js';
import { useTheme } from '../runtime/hooks.js';
import { fitTo, stringWidth } from '../util/text.js';

/**
 * Charts.
 *
 * A terminal chart has one cell of resolution vertically and one horizontally,
 * so the honest approach is to pick glyphs that subdivide a cell - eight block
 * levels, four braille dots - rather than to pretend at pixel plotting. Every
 * chart here also states its numbers, because a shape without a scale is
 * decoration.
 */

const TONE: Record<SemanticVariant, StyleColor> = {
  default: 'text', primary: 'primary', secondary: 'secondary', accent: 'accent',
  success: 'success', warning: 'warning', danger: 'danger', info: 'info', muted: 'muted',
};

export interface Series {
  values: number[];
  label?: string;
  tone?: SemanticVariant;
}

function bounds(values: number[], min?: number, max?: number): [number, number] {
  if (values.length === 0) return [min ?? 0, max ?? 1];
  const lo = min ?? Math.min(...values);
  const hi = max ?? Math.max(...values);
  return lo === hi ? [lo, lo + 1] : [lo, hi];
}

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

/** Take `width` samples, averaging when there is more data than cells. */
function resample(values: number[], width: number): number[] {
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

const VerticalBars = defineComponent<{
  data: { label: string; value: number; tone?: SemanticVariant }[];
  max: number;
  height: number;
}>('VerticalBars', ({ data, max, height, ...rest }) => {
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
            content: col.cells[height - 1 - row] as string,
            fg: TONE[col.item.tone ?? 'accent'],
          })))),
    h('box', { direction: 'row', gap: 1 },
      ...data.map((item, i) =>
        h('text', { key: i, content: item.label.slice(0, 1), fg: 'subtle' }))),
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

/**
 * A line chart on a braille canvas: each cell holds a 2x4 dot grid, so a
 * 40x8 chart really has 80x32 plot positions.
 */
export const LineChart = defineComponent<LineChartProps>('LineChart', (props) => {
  const theme = useTheme();
  const {
    series, min, max, chartWidth, chartHeight = 8,
    axis = true, area = false, format, ...rest
  } = props;

  const all = series.flatMap((s) => s.values);
  const [lo, hi] = bounds(all, min, max);
  const braille = theme.glyphs.blocks.length > 0 && theme.glyphs.spinner[0] !== '|';

  const draw = (surface: PaintSurface, ctx: RenderContext): void => {
    const { width, height } = surface.rect;
    if (width <= 0 || height <= 0) return;

    for (const [index, s] of series.entries()) {
      const color = ctx.color(TONE[s.tone ?? (index === 0 ? 'accent' : 'secondary')]);
      const points = resample(s.values, braille ? width * 2 : width);

      if (braille) {
        // Accumulate dots per cell, then emit one braille glyph per cell.
        const cells = new Map<string, number>();
        for (let px = 0; px < points.length; px++) {
          const value = points[px] as number;
          const ratio = (value - lo) / (hi - lo);
          const py = Math.round((1 - ratio) * (height * 4 - 1));
          const startY = area ? py : py;
          const endY = area ? height * 4 - 1 : py;
          for (let y = startY; y <= endY; y++) {
            const cx = Math.floor(px / 2);
            const cy = Math.floor(y / 4);
            const key = `${cx},${cy}`;
            cells.set(key, (cells.get(key) ?? 0) | brailleBit(px % 2, y % 4));
          }
        }
        for (const [key, bits] of cells) {
          const [cx, cy] = key.split(',').map(Number) as [number, number];
          surface.put(cx, cy, String.fromCharCode(0x2800 + bits), { fg: color });
        }
        continue;
      }

      // No braille: fall back to block levels, one column per cell.
      const blocks = theme.glyphs.blocks;
      for (let x = 0; x < points.length && x < width; x++) {
        const ratio = ((points[x] as number) - lo) / (hi - lo);
        const y = Math.round((1 - ratio) * (height - 1));
        const level = blocks[Math.max(0, Math.min(blocks.length - 1, Math.round(ratio * (blocks.length - 1))))] as string;
        surface.put(x, y, level, { fg: color });
      }
    }
  };

  const chart = h('canvas', {
    draw,
    flex: 1,
    height: chartHeight,
    ...(chartWidth !== undefined ? { width: chartWidth } : {}),
  });

  if (!axis) return h('box', { direction: 'column', ...rest }, chart);

  const fmt = format ?? ((v: number): string => (Number.isInteger(v) ? String(v) : v.toFixed(1)));
  const axisWidth = Math.max(stringWidth(fmt(hi)), stringWidth(fmt(lo)));

  return h('box', { direction: 'column', ...rest },
    h('box', { direction: 'row', gap: 1 },
      h('box', { direction: 'column', width: axisWidth, height: chartHeight, justify: 'between' },
        h('text', { content: fitTo(fmt(hi), axisWidth, 'right'), fg: 'subtle' }),
        h('text', { content: fitTo(fmt(lo), axisWidth, 'right'), fg: 'subtle' })),
      chart),
    series.some((s) => s.label)
      ? h('box', { direction: 'row', gap: 2 },
          ...series.map((s, i) =>
            h('box', { key: i, direction: 'row', gap: 1 },
              h('text', { content: theme.glyphs.bulletFilled, fg: TONE[s.tone ?? (i === 0 ? 'accent' : 'secondary')] }),
              h('text', { content: s.label ?? `series ${i + 1}`, fg: 'muted' }))))
      : null,
  );
});

function brailleBit(x: number, y: number): number {
  // Braille dot numbering is column-major and not contiguous; this is the map.
  const MAP = [
    [0x01, 0x08],
    [0x02, 0x10],
    [0x04, 0x20],
    [0x40, 0x80],
  ];
  return (MAP[y] as number[])[x] as number;
}

export type AreaChartProps = LineChartProps;

export const AreaChart = defineComponent<AreaChartProps>('AreaChart', (props) =>
  h(LineChart, { area: true, ...props }),
);

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

export const CHART_COMPONENTS: ComponentDefinition[] = [
  { component: 'Sparkline', category: 'chart', renderer: { kind: 'function', render: Sparkline }, description: 'One row of block glyphs; eight levels per cell.' },
  { component: 'BarChart', category: 'chart', renderer: { kind: 'function', render: BarChart }, description: 'Labelled bars, horizontal or vertical.' },
  { component: 'LineChart', category: 'chart', renderer: { kind: 'function', render: LineChart }, description: 'Braille plot at 2x4 the cell resolution.' },
  { component: 'AreaChart', category: 'chart', renderer: { kind: 'function', render: AreaChart }, description: 'A line chart, filled.' },
  { component: 'Histogram', category: 'chart', renderer: { kind: 'function', render: Histogram }, description: 'Bucketed distribution.' },
  { component: 'Gauge', category: 'chart', renderer: { kind: 'function', render: Gauge }, role: 'meter', description: 'A reading against thresholds.' },
  { component: 'Heatmap', category: 'chart', renderer: { kind: 'function', render: Heatmap }, description: 'A grid of intensities.' },
];

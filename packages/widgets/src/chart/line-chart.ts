import type { PaintSurface, RenderContext } from '@textui/core';
import { defineComponent, fitTo, h, stringWidth, useTheme } from '@textui/core';
import type { LineChartProps } from './shared.js';
import { TONE, bounds, resample } from './shared.js';

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

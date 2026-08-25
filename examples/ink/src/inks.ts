import type { Color } from '@textui/core';
import type { Ink } from '@textui/widgets';
import { blend, gradientAt } from '@textui/widgets';

/**
 * The inks the demo cycles through.
 *
 * Ordered to make one point in sequence: the first four are ramps, the next
 * three are palettes walked in runs, and the last two are functions - the
 * escape hatch, and the reason the prop takes one at all. Everything above
 * the line is data and would survive being written in a JSON screen; the two
 * below it would not, which is the trade a function prop makes.
 */
export interface Preset {
  id: string;
  title: string;
  /** Why this one exists, shown under the list. */
  note: string;
  ink?: Ink;
}

/** A six-stop ramp, so the middle of a wide banner is not just two colours mixed. */
const SPECTRUM: Color[] = ['#ff004d', '#ff8c00', '#ffe600', '#00d68f', '#00b7ff', '#a45cff'];

export const PRESETS: Preset[] = [
  {
    id: 'none',
    title: 'none',
    note: 'No ink at all. The same component, drawing the same text in one colour - which is what a <text> would have done.',
  },
  {
    id: 'sunrise',
    title: 'sunrise',
    note: "{ gradient: ['#ff5f6d', '#ffc371'] } - two stops across the block.",
    ink: { gradient: ['#ff5f6d', '#ffc371'] },
  },
  {
    id: 'spectrum',
    title: 'spectrum',
    note: 'Six stops. The ramp is measured against the widest line, so the colours line up down the block.',
    ink: { gradient: SPECTRUM },
  },
  {
    id: 'depth',
    title: 'depth',
    note: "axis: 'y' - the ramp runs down the lines instead of across the columns.",
    ink: { gradient: ['#2e3192', '#1bffff'], axis: 'y' },
  },
  {
    id: 'corner',
    title: 'corner',
    note: "axis: 'xy' - a diagonal, from the top left corner to the bottom right one.",
    ink: { gradient: ['#f7971e', '#ff2e63'], axis: 'xy' },
  },
  {
    id: 'per-line',
    title: 'per line',
    note: 'An array of colours is the short spelling of one colour per line, repeating. Theme tokens, so it follows the theme.',
    ink: ['danger', 'warning', 'success', 'info'],
  },
  {
    id: 'runs',
    title: '4 3 4 3',
    note: 'every: [4, 3] - four cells of one colour, three of the next, and round again. The run restarts on each line, which is what keeps the bands vertical.',
    ink: { cycle: SPECTRUM, every: [4, 3] },
  },
  {
    id: 'diagonal',
    title: 'diagonal',
    note: 'The same runs, carried across the line breaks instead of restarting. The bands lean.',
    ink: { cycle: SPECTRUM, every: 3, continuous: true },
  },
  {
    id: 'by-word',
    title: 'by word',
    note: "unit: 'word' - one colour a word, which only says anything in plain text - ctrl+p to see it.",
    ink: { cycle: ['#00b7ff', '#ffe600', '#00d68f'], unit: 'word' },
  },
  {
    id: 'checks',
    title: 'checkerboard',
    note: 'A function: (cell) => (cell.col + cell.line) % 2 ? ... - it is handed the cell and answers with a colour.',
    ink: (cell) => ((cell.col + cell.line) % 2 === 0 ? '#00d68f' : '#0a6b4a'),
  },
  {
    id: 'spotlight',
    title: 'spotlight',
    note: 'A function again, this time computing a distance: colour falls off from the middle of the block, so the shape is not one of the built-in axes.',
    ink: (cell, ctx) => {
      const cx = (cell.blockWidth - 1) / 2;
      const cy = (cell.height - 1) / 2;
      // Columns are half the height of a cell, so a circle wants the x
      // distance halved - otherwise the spotlight is a wide ellipse.
      const dx = (cell.col - cx) / Math.max(1, cell.blockWidth / 2) / 2;
      const dy = (cell.line - cy) / Math.max(1, cell.height / 2);
      const far = Math.min(1, Math.sqrt(dx * dx + dy * dy));
      return blend('#fff6d5', ctx.color('muted'), far);
    },
  },
  {
    id: 'vowels',
    title: 'vowels',
    note: 'Nothing says an ink has to colour every cell: this one returns undefined for most of them, and undefined means "leave it to the component’s own fg".',
    ink: (cell) => ('aeiou'.includes(cell.char.toLowerCase()) ? '#ff2e63' : undefined),
  },
];

/** The spectrum sampled into `steps` colours, for the strip under the list. */
export function sample(steps: number): Color[] {
  return Array.from({ length: steps }, (_, i) =>
    gradientAt(SPECTRUM, steps > 1 ? i / (steps - 1) : 0));
}

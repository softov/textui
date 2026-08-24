import type { RenderOutput } from '@textui/core';
import { defineComponent, h, useTheme } from '@textui/core';

/**
 * A one-cell scrollbar.
 *
 * Exported because anything with a viewport wants the same one: two components
 * drawing their own would drift, and the thumb is the only thing on screen
 * that says how much of a file you are looking at.
 */
export const ScrollThumb = defineComponent<{
  total: number;
  rows: number;
  offset: number;
  focused: boolean;
}>('ScrollThumb', ({ total, rows, offset, focused }) => {
  const theme = useTheme();
  // Not border glyphs: `left` and `right` are the same character in every
  // border style, so a thumb drawn with one would be invisible against a
  // track drawn with the other.
  const thumbChar = theme.glyphs.progressFull;
  const trackChar = theme.glyphs.progressEmpty;
  const track = Math.max(1, rows);
  const size = Math.max(1, Math.round((rows / Math.max(1, total)) * track));
  const span = Math.max(0, track - size);
  const position = total <= rows
    ? 0
    : Math.round((offset / Math.max(1, total - rows)) * span);

  const cells: RenderOutput[] = [];
  for (let i = 0; i < track; i++) {
    const onThumb = i >= position && i < position + size;
    cells.push(h('text', {
      key: i,
      content: onThumb ? thumbChar : trackChar,
      fg: onThumb ? (focused ? 'focus' : 'border') : 'borderSubtle',
    }));
  }
  return h('box', { width: 1, direction: 'column' }, ...cells);
});

import type { BoxProps } from '@textui/core';
import { defineComponent, h } from '@textui/core';

export interface SkeletonProps extends BoxProps {
  lines?: number;
  /** Width of each line, in cells or as a fraction of the box. */
  widths?: number[];
}

/**
 * The shape of content that has not arrived.
 *
 * Drawn in `borderStrong` rather than `borderSubtle`, and the difference is
 * whether it is there at all: against the dark theme's canvas, subtle is
 * 1.24:1 - the glyphs are in the buffer and nobody can see them, which is a
 * placeholder that fails at the one thing it does. Strong is 2.28:1, still
 * quiet enough not to read as content.
 *
 * `fg` overrides it, because how loud a placeholder should be depends on what
 * it is standing in for.
 */
export const Skeleton = defineComponent<SkeletonProps>('Skeleton', ({ lines = 3, widths, fg, ...rest }) =>
  h('box', { direction: 'column', gap: 0, ...rest },
    ...Array.from({ length: lines }, (_, i) =>
      h('box', {
        key: i,
        height: 1,
        width: widths?.[i] ?? (i === lines - 1 ? '60%' : '100%'),
        fill: '░',
        fg: fg ?? 'borderStrong',
      }),
    ),
  ),
);

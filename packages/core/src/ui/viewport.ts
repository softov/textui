import type { Rect } from '../types/geometry.js';
import type { Dimension } from '../types/style.js';

/**
 * How many rows a scrolling component should draw.
 *
 * The subtle part is knowing when the measurement means anything. A box that
 * was stretched, flexed or given a height fills what the layout handed it, and
 * measuring tells it how much that was. A box with none of those is sized *by*
 * its own content - measuring it just reports back how many rows it drew last
 * frame, and clamping to that would mean an expanding tree could never grow
 * past the size it had when it was first drawn.
 *
 * So: layout-sized components fill and scroll, content-sized ones draw
 * everything, and which one you get is decided by the props you passed.
 */
export interface SizedProps {
  flex?: number;
  height?: Dimension;
  maxHeight?: number;
  basis?: Dimension;
}

export function sizedByLayout(props: SizedProps): boolean {
  return (
    props.flex !== undefined ||
    props.height !== undefined ||
    props.maxHeight !== undefined ||
    props.basis !== undefined
  );
}

/**
 * The row count to render: what was asked for, else what fits, else all of it.
 * `reserved` takes off rows the component spends on chrome, like a header.
 */
export function viewportRows(
  props: SizedProps,
  measured: Rect,
  content: number,
  options: { requested?: number; reserved?: number } = {},
): number {
  if (options.requested !== undefined) return Math.max(1, options.requested);
  if (!sizedByLayout(props) || measured.height <= 0) return content;
  return Math.max(1, measured.height - (options.reserved ?? 0));
}
